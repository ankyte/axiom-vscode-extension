import * as path from 'path';
import { SemanticCompressionEngine } from '../compression/SemanticCompressionEngine';
import { RelationshipEngine, MemoryGraph } from '../graph/RelationshipEngine';
import { IngestionPipeline } from '../ingestion/IngestionPipeline';
import { LocalSignalCollector } from '../ingestion/LocalSignalCollector';
import { RemoteSignalMapper } from '../ingestion/RemoteSignalMapper';
import { SignalNormalizer } from '../ingestion/SignalNormalizer';
import { DriftDetectionEngine } from '../memory/DriftDetectionEngine';
import { MemoryExtractionEngine } from '../memory/MemoryExtractionEngine';
import { ContextRetrievalResult, MemoryRecord, RetrievalContext } from '../models/memory';
import { EngineeringSignal } from '../models/signals';
import { IAzureDevOpsProvider } from '../providers/IAzureDevOpsProvider';
import { IEmbeddingProvider } from '../providers/IEmbeddingProvider';
import { ILLMProvider } from '../providers/ILLMProvider';
import { MockAzureDevOpsProvider } from '../providers/MockAzureDevOpsProvider';
import { MockEmbeddingProvider } from '../providers/MockEmbeddingProvider';
import { MockLLMProvider } from '../providers/MockLLMProvider';
import { RiskEngine } from '../risk/RiskEngine';
import { ContextRetrievalEngine } from '../retrieval/ContextRetrievalEngine';
import { IMemoryStore } from '../storage/IMemoryStore';
import { MockS3MemoryStore } from '../storage/MockS3MemoryStore';
import { TimelineEngine } from '../timeline/TimelineEngine';
import { hashId } from '../utils';

export interface AxiomKernelOptions {
  storageRoot: string;
  workspaceRoot?: string;
  azure?: IAzureDevOpsProvider;
  store?: IMemoryStore;
  embeddings?: IEmbeddingProvider;
  llm?: ILLMProvider;
}

export class AxiomKernel {
  private readonly azure: IAzureDevOpsProvider;
  private readonly store: IMemoryStore;
  private readonly embeddings: IEmbeddingProvider;
  private readonly llm: ILLMProvider;
  private readonly relationships = new RelationshipEngine();
  private readonly localSignals = new LocalSignalCollector();
  private readonly remoteSignals: RemoteSignalMapper;
  private readonly pipeline: IngestionPipeline;
  private readonly retrieval: ContextRetrievalEngine;
  private readonly connectedRepos = new Set<string>();
  private readonly workspaceRoot?: string;
  private activeContext: RetrievalContext;
  private poller?: NodeJS.Timeout;

  constructor(options: AxiomKernelOptions) {
    this.azure = options.azure ?? new MockAzureDevOpsProvider();
    this.store = options.store ?? new MockS3MemoryStore(options.storageRoot);
    this.embeddings = options.embeddings ?? new MockEmbeddingProvider();
    this.llm = options.llm ?? new MockLLMProvider();
    this.workspaceRoot = options.workspaceRoot;
    const defaultRepo = options.workspaceRoot ? path.basename(options.workspaceRoot) : 'pricing-service';
    this.activeContext = { repo: defaultRepo };
    this.remoteSignals = new RemoteSignalMapper(this.azure);
    this.pipeline = new IngestionPipeline(new SignalNormalizer(), new MemoryExtractionEngine(this.embeddings, this.llm), this.store);
    this.retrieval = new ContextRetrievalEngine(
      this.store,
      this.embeddings,
      this.relationships,
      new SemanticCompressionEngine(this.llm),
      new RiskEngine(),
      new DriftDetectionEngine(),
      new TimelineEngine(),
      (repo) => this.azure.getRepositoryConnections(repo),
    );
  }

  public async bootstrap(): Promise<void> {
    const repos = await this.azure.getRepositories();
    const repoNames = repos.map((repo) => repo.name);
    const preferred = repoNames.includes(this.activeContext.repo) ? this.activeContext.repo : 'pricing-service';
    await this.connectRepository(preferred);
    if (this.workspaceRoot && preferred !== this.activeContext.repo) {
      await this.connectRepository(this.activeContext.repo);
    }
  }

  public startPolling(intervalMs = 45_000): void {
    if (this.poller) return;
    this.poller = setInterval(() => {
      void this.simulateRemotePoll();
    }, intervalMs);
  }

  public dispose(): void {
    if (this.poller) clearInterval(this.poller);
  }

  public async connectRepository(repoName: string): Promise<void> {
    this.connectedRepos.add(repoName);
    this.activeContext = { ...this.activeContext, repo: repoName };
    const remote = await this.remoteSignals.fromRepository(repoName);
    const local = this.workspaceRoot ? await this.localSignals.collect(this.workspaceRoot, repoName) : [];
    await this.pipeline.ingest([...remote, ...local]);
    await this.indexRepositoryRelationships(repoName);
  }

  public async recordActiveFile(filePath: string): Promise<void> {
    const repo = this.activeContext.repo;
    this.activeContext = { ...this.activeContext, file: filePath };
    await this.pipeline.ingest([this.localSignals.fileOpened(repo, filePath)]);
  }

  public async ingestLocalCommit(message: string, commitId = hashId(`${message}:${Date.now()}`), branch = 'local'): Promise<void> {
    await this.pipeline.ingest([this.localSignals.localCommit(this.activeContext.repo, message, commitId, branch)]);
  }

  public async handlePullRequestMerged(repo: string, pullRequestId: string): Promise<void> {
    const details = await this.azure.getPullRequestDetails(repo, pullRequestId);
    if (!details) return;
    await this.pipeline.ingest(await this.remoteSignals.fromRepository(repo));
    const memories = await this.store.getMemories({ repo });
    for (const memory of memories.filter((item) => item.source.sourceId === pullRequestId || item.relatedEntities.some((entity) => entity.id === pullRequestId))) {
      await this.store.updateMemory(memory.id, { state: 'CANONICAL', embedding: await this.embeddings.generateEmbedding(memory.summary) });
    }
  }

  public async simulateRemotePoll(): Promise<void> {
    for (const repo of this.connectedRepos) {
      await this.pipeline.ingest(await this.remoteSignals.fromRepository(repo));
    }
  }

  public async retrieve(context: Partial<RetrievalContext> = {}): Promise<ContextRetrievalResult> {
    const merged = { ...this.activeContext, ...context };
    this.activeContext = merged;
    const existing = await this.store.getMemories({ repo: merged.repo, limit: 1 });
    if (existing.length === 0) {
      await this.connectRepository(merged.repo);
    }
    return this.retrieval.retrieve(merged);
  }

  public async getGraph(repo = this.activeContext.repo): Promise<MemoryGraph> {
    const [memories, connections] = await Promise.all([this.store.getMemories({ repo }), this.azure.getRepositoryConnections(repo)]);
    return this.relationships.build(memories, connections);
  }

  public getActiveContext(): RetrievalContext {
    return this.activeContext;
  }

  public getConnectedRepositories(): string[] {
    return [...this.connectedRepos];
  }

  public async getMemories(repo = this.activeContext.repo): Promise<MemoryRecord[]> {
    return this.store.getMemories({ repo });
  }

  private async indexRepositoryRelationships(repoName: string): Promise<void> {
    const connections = await this.azure.getRepositoryConnections(repoName);
    for (const connection of connections) {
      await this.store.saveMemory(this.relationships.relationshipMemory(repoName, connection));
      this.connectedRepos.add(connection.fromRepo);
      this.connectedRepos.add(connection.toRepo);
    }
  }
}
