import { MemoryRecord, TimelineEvent } from '../models/memory';

export class TimelineEngine {
  public build(memories: MemoryRecord[]): TimelineEvent[] {
    return memories
      .map((memory) => ({
        id: `timeline:${memory.id}`,
        repo: memory.repo,
        timestamp: memory.timestamp,
        title: this.title(memory),
        description: memory.summary,
        type: memory.type,
        provenance: memory.source,
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private title(memory: MemoryRecord): string {
    if (memory.type === 'INCIDENT') return 'incident';
    if (memory.type === 'REGRESSION') return 'rollback/regression';
    if (memory.type === 'ARCHITECTURAL_INTENT') return 'architecture intent';
    if (memory.type === 'DRIFT') return 'drift detected';
    return 'memory captured';
  }
}
