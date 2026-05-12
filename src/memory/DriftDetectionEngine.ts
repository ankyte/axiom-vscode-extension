import { DriftMemory, MemoryRecord, RiskLevel } from '../models/memory';
import { hashId } from '../utils';

export class DriftDetectionEngine {
  public detect(repo: string, memories: MemoryRecord[]): DriftMemory[] {
    const text = memories.map((memory) => `${memory.summary} ${memory.tags.join(' ')}`).join(' ').toLowerCase();
    const drifts: DriftMemory[] = [];
    if (text.includes('exponential') && text.includes('fixed retries')) {
      drifts.push(this.make(repo, 'exponential backoff', 'fixed retries', 'HIGH', 'Retry policy drift: declared exponential backoff but recent signal observed fixed retries.'));
    }
    if (text.includes('idempotency') && text.includes('async') && text.includes('duplicate')) {
      drifts.push(this.make(repo, 'idempotent async execution', 'duplicate execution risk remains active', 'HIGH', 'Async execution drift: idempotency intent exists but duplicate execution remains linked.'));
    }
    if (text.includes('architecture') && text.includes('todo')) {
      drifts.push(this.make(repo, 'documented architecture', 'unfinished TODO/FIXME near architectural code', 'MEDIUM', 'Architecture drift: implementation carries unresolved TODO near declared intent.'));
    }
    return drifts;
  }

  private make(repo: string, expected: string, observed: string, severity: RiskLevel, summary: string): DriftMemory {
    return {
      id: hashId(`drift:${repo}:${expected}:${observed}`),
      type: 'DRIFT',
      repo,
      state: 'PROVISIONAL',
      summary,
      source: { provider: 'drift-engine', sourceId: `${expected}:${observed}`, label: 'Drift Detection Engine' },
      timestamp: new Date().toISOString(),
      confidence: severity === 'HIGH' ? 0.9 : 0.76,
      tags: ['drift', severity.toLowerCase(), expected, observed],
      relatedEntities: [],
      expected,
      observed,
      severity,
    };
  }
}
