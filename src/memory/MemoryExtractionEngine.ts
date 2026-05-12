import { MemoryRecord, MemoryState, MemoryType, RelatedEntity } from '../models/memory';
import { NormalizedSignal } from '../models/signals';
import { IEmbeddingProvider } from '../providers/IEmbeddingProvider';
import { ILLMProvider } from '../providers/ILLMProvider';
import { hashId } from '../utils';

export class MemoryExtractionEngine {
  constructor(private readonly embeddings: IEmbeddingProvider, private readonly llm: ILLMProvider) {}

  public async extract(signal: NormalizedSignal): Promise<MemoryRecord[]> {
    const type = this.detectType(signal);
    const state = this.detectState(signal);
    const summary = await this.summarize(signal, type);
    const relatedEntities = this.relatedEntities(signal);
    const confidence = this.confidence(signal, type);
    const memory: MemoryRecord = {
      id: hashId(`${signal.id}:${type}:${summary}`),
      type,
      repo: signal.repo,
      file: signal.file,
      branch: signal.branch,
      state,
      summary,
      source: signal.source,
      timestamp: signal.timestamp,
      confidence,
      tags: [...new Set([...signal.riskTags, ...signal.keywords.filter((keyword) => this.highSignal(keyword)).slice(0, 8)])],
      relatedEntities,
      rawSignalId: signal.id,
    };
    memory.embedding = await this.embeddings.generateEmbedding(`${memory.summary} ${memory.tags.join(' ')}`);
    return [memory];
  }

  private detectType(signal: NormalizedSignal): MemoryType {
    if (signal.type === 'INCIDENT_LINKED') return 'INCIDENT';
    if (signal.type === 'ROLLBACK_DETECTED' || signal.riskTags.includes('rollback')) return 'REGRESSION';
    if (signal.type === 'PR_MERGED' && signal.riskTags.includes('incident')) return 'HISTORICAL_CONTEXT';
    if (signal.type === 'ARCHITECTURE_FILE_CHANGED' || signal.riskTags.includes('retry')) return 'ARCHITECTURAL_INTENT';
    if (signal.type === 'TODO_DETECTED') return 'TRIBAL_KNOWLEDGE';
    if (signal.type === 'DEPENDENCY_CHANGE') return 'RELATIONSHIP';
    return signal.type.startsWith('LOCAL') ? 'TRIBAL_KNOWLEDGE' : 'HISTORICAL_CONTEXT';
  }

  private detectState(signal: NormalizedSignal): MemoryState {
    if (signal.type === 'LOCAL_COMMIT' || signal.type === 'FILE_OPENED' || signal.type === 'TODO_DETECTED') return 'PROVISIONAL';
    if (signal.type === 'PR_MERGED') return 'CANONICAL';
    if (signal.type === 'PR_CREATED' || signal.type === 'PR_COMMENT') return 'PROVISIONAL';
    return 'CANONICAL';
  }

  private async summarize(signal: NormalizedSignal, type: MemoryType): Promise<string> {
    const text = `${signal.title}. ${signal.body}`;
    if (type === 'INCIDENT') return this.sentence(await this.llm.summarizeIncident(text));
    if (type === 'ARCHITECTURAL_INTENT') return this.sentence(await this.llm.extractIntent(text));
    if (type === 'REGRESSION') return this.sentence(`Regression: ${await this.llm.compressContext(text)}`);
    return this.sentence(await this.llm.compressContext(text));
  }

  private relatedEntities(signal: NormalizedSignal): RelatedEntity[] {
    return [
      ...signal.entities.repositories.filter((repo) => repo !== signal.repo).map((repo) => ({ kind: 'repo' as const, id: repo, label: repo, relation: 'mentions_repo' })),
      ...signal.entities.files.map((file) => ({ kind: 'file' as const, id: file, label: file, relation: 'touches_file' })),
      ...signal.entities.incidents.map((id) => ({ kind: 'incident' as const, id, label: `Incident #${id}`, relation: 'linked_incident' })),
      ...signal.entities.pullRequests.map((id) => ({ kind: 'pr' as const, id, label: `PR #${id}`, relation: 'linked_pr' })),
      ...signal.entities.commits.map((id) => ({ kind: 'commit' as const, id, label: `Commit ${id}`, relation: 'linked_commit' })),
      ...signal.entities.dependencies.map((id) => ({ kind: 'dependency' as const, id, label: id, relation: 'depends_on' })),
    ];
  }

  private confidence(signal: NormalizedSignal, type: MemoryType): number {
    let score = signal.source.provider === 'azure-devops' ? 0.76 : 0.62;
    if (signal.riskTags.includes('incident')) score += 0.12;
    if (signal.riskTags.includes('rollback')) score += 0.1;
    if (type === 'ARCHITECTURAL_INTENT') score += 0.06;
    if (signal.entities.incidents.length > 0 || signal.entities.pullRequests.length > 0) score += 0.05;
    return Math.min(0.98, Number(score.toFixed(2)));
  }

  private highSignal(keyword: string): boolean {
    return ['retry', 'rollback', 'incident', 'outage', 'async', 'race', 'pricing', 'settlement', 'vendor', 'throttle', 'idempotency', 'duplicate', 'backoff'].includes(keyword);
  }

  private sentence(text: string): string {
    const trimmed = text.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
}
