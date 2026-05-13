import { ArchitectureRuleSet } from '../models/architectureRules';
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
    private readonly getRuleSet: (repo: string) => Promise<ArchitectureRuleSet>,
  ) {}

  public async retrieve(context: RetrievalContext): Promise<ContextRetrievalResult> {
    const repoMemories = await this.store.getMemories({ repo: context.repo });
    const fileMemories = context.file ? await this.store.getMemories({ repo: context.repo, file: context.file }) : [];
    const semanticMatches = await this.embeddings.similaritySearch(
      context.query ?? `${context.repo} ${context.file ?? ''} retry incident rollback architecture`,
      repoMemories,
      12,
    );
    const combined = this.rank(this.unique([...fileMemories, ...semanticMatches.map((match) => match.memory), ...repoMemories.slice(0, 30)]), context);
    const [connections, ruleSet] = await Promise.all([this.getConnections(context.repo), this.getRuleSet(context.repo)]);
    const connectedRepositories = this.relationships.connectedRepositories(context.repo, connections, combined);
    const drift = this.drift.detect(context.repo, combined, ruleSet);
    for (const driftMemory of drift) {
      await this.store.saveMemory(driftMemory);
    }
    const packet = await this.compression.createPacket([...combined.slice(0, 16), ...drift]);
    await this.store.saveCompressedPacket(packet);
    return {
      repo: context.repo,
      file: context.file,
      historicalContext: combined.filter((memory) => memory.type === 'HISTORICAL_CONTEXT' || memory.type === 'TRIBAL_KNOWLEDGE').slice(0, 8),
      relatedIncidents: combined.filter((memory) => memory.type === 'INCIDENT' || memory.relatedEntities.some((entity) => entity.kind === 'incident')).slice(0, 8),
      architecturalIntent: combined.filter((memory) => memory.type === 'ARCHITECTURAL_INTENT').slice(0, 8),
      risks: this.risk.score(context.repo, [...combined, ...drift], context.file),
      drift,
      compressedPacket: packet,
      connectedRepositories,
      timeline: this.timeline.build(combined).slice(-10),
      ruleSources: ruleSet.sources,
      retrievalReasons: this.retrievalReasons(context, semanticMatches.map((match) => `${match.memory.source.label} (${match.score})`), ruleSet),
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  private unique(memories: MemoryRecord[]): MemoryRecord[] {
    const byId = new Map<string, MemoryRecord>();
    for (const memory of memories) byId.set(memory.id, memory);
    return [...byId.values()].sort((a, b) => b.confidence - a.confidence || b.timestamp.localeCompare(a.timestamp));
  }

  private rank(memories: MemoryRecord[], context: RetrievalContext): MemoryRecord[] {
    const now = Date.now();
    return [...memories].sort((a, b) => this.score(b, context, now) - this.score(a, context, now));
  }

  private score(memory: MemoryRecord, context: RetrievalContext, now: number): number {
    const ageDays = Math.max(0, (now - Date.parse(memory.timestamp || new Date().toISOString())) / 86_400_000);
    const recency = Math.max(0, 1 - ageDays / 365);
    const fileBoost = context.file && (memory.file === context.file || memory.relatedEntities.some((entity) => entity.kind === 'file' && entity.label === context.file)) ? 0.22 : 0;
    const canonicalBoost = memory.state === 'CANONICAL' ? 0.14 : memory.state === 'PROVISIONAL' ? 0.07 : 0;
    const riskBoost = memory.tags.some((tag) => ['incident', 'rollback', 'hotfix', 'drift', 'duplicate-execution'].includes(tag)) ? 0.18 : 0;
    return memory.confidence * 0.55 + recency * 0.12 + fileBoost + canonicalBoost + riskBoost;
  }

  private retrievalReasons(context: RetrievalContext, matches: string[], ruleSet: ArchitectureRuleSet): string[] {
    return [
      `metadata scope: repo=${context.repo}${context.file ? ` file=${context.file}` : ''}`,
      `semantic matches: ${matches.slice(0, 3).join(', ') || 'none'}`,
      `rule sources: ${ruleSet.sources.join(', ') || 'none'}`,
    ];
  }
}
