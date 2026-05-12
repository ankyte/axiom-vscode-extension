import { ContextRetrievalResult, MemoryRecord, RetrievalContext } from '../models/memory';
import { RepositoryConnection } from '../models/signals';
import { SemanticCompressionEngine } from '../compression/SemanticCompressionEngine';
import { RelationshipEngine } from '../graph/RelationshipEngine';
import { DriftDetectionEngine } from '../memory/DriftDetectionEngine';
import { IEmbeddingProvider } from '../providers/IEmbeddingProvider';
import { RiskEngine } from '../risk/RiskEngine';
import { IMemoryStore } from '../storage/IMemoryStore';
import { TimelineEngine } from '../timeline/TimelineEngine';

export class ContextRetrievalEngine {
  constructor(
    private readonly store: IMemoryStore,
    private readonly embeddings: IEmbeddingProvider,
    private readonly relationships: RelationshipEngine,
    private readonly compression: SemanticCompressionEngine,
    private readonly risk: RiskEngine,
    private readonly drift: DriftDetectionEngine,
    private readonly timeline: TimelineEngine,
    private readonly getConnections: (repo: string) => Promise<RepositoryConnection[]>,
  ) {}

  public async retrieve(context: RetrievalContext): Promise<ContextRetrievalResult> {
    const repoMemories = await this.store.getMemories({ repo: context.repo });
    const fileMemories = context.file ? await this.store.getMemories({ repo: context.repo, file: context.file }) : [];
    const semanticMatches = await this.embeddings.similaritySearch(
      context.query ?? `${context.repo} ${context.file ?? ''} retry incident rollback architecture`,
      repoMemories,
      12,
    );
    const combined = this.unique([...fileMemories, ...semanticMatches.map((match) => match.memory), ...repoMemories.slice(0, 20)]);
    const connections = await this.getConnections(context.repo);
    const connectedRepositories = this.relationships.connectedRepositories(context.repo, connections, combined);
    const drift = this.drift.detect(context.repo, combined);
    const packet = await this.compression.createPacket([...combined.slice(0, 16), ...drift]);
    await this.store.saveCompressedPacket(packet);
    return {
      repo: context.repo,
      file: context.file,
      historicalContext: combined.filter((memory) => memory.type === 'HISTORICAL_CONTEXT' || memory.type === 'TRIBAL_KNOWLEDGE').slice(0, 8),
      relatedIncidents: combined.filter((memory) => memory.type === 'INCIDENT' || memory.relatedEntities.some((entity) => entity.kind === 'incident')).slice(0, 8),
      architecturalIntent: combined.filter((memory) => memory.type === 'ARCHITECTURAL_INTENT').slice(0, 8),
      risks: this.risk.score(context.repo, combined, context.file),
      drift,
      compressedPacket: packet,
      connectedRepositories,
      timeline: this.timeline.build(combined).slice(-10),
    };
  }

  private unique(memories: MemoryRecord[]): MemoryRecord[] {
    const byId = new Map<string, MemoryRecord>();
    for (const memory of memories) byId.set(memory.id, memory);
    return [...byId.values()].sort((a, b) => b.confidence - a.confidence || b.timestamp.localeCompare(a.timestamp));
  }
}
