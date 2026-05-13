import * as fs from 'fs/promises';
import * as path from 'path';
import { ArchitectureRule } from '../models/architectureRules';
import { CompressedPacket, MemoryQuery, MemoryRecord, TimelineEvent } from '../models/memory';
import { IMemoryStore } from './IMemoryStore';

interface PersistedMemoryStore {
  schemaVersion: number;
  memories: MemoryRecord[];
  packets: CompressedPacket[];
  timeline: TimelineEvent[];
  architectureRules: ArchitectureRule[];
}

export class MockS3MemoryStore implements IMemoryStore {
  private loaded = false;
  private data: PersistedMemoryStore = { schemaVersion: 2, memories: [], packets: [], timeline: [], architectureRules: [] };

  constructor(private readonly storageRoot: string) {}

  public async saveMemory(memory: MemoryRecord): Promise<void> {
    // TODO: REAL S3 IMPLEMENTATION HERE
    await this.ensureLoaded();
    const index = this.data.memories.findIndex((item) => item.id === memory.id);
    if (index >= 0) {
      this.data.memories[index] = this.mergeMemory(this.data.memories[index], memory);
    } else {
      const duplicate = this.findDuplicate(memory);
      if (duplicate) {
        const duplicateIndex = this.data.memories.findIndex((item) => item.id === duplicate.id);
        this.data.memories[duplicateIndex] = this.mergeMemory(duplicate, memory);
      } else {
        this.data.memories.push(memory);
      }
    }
    this.upsertTimeline(memory);
    await this.persist();
  }

  public async getMemories(query: MemoryQuery = {}): Promise<MemoryRecord[]> {
    // TODO: REAL S3 IMPLEMENTATION HERE
    await this.ensureLoaded();
    return this.applyQuery(this.data.memories, query);
  }

  public async updateMemory(memoryId: string, patch: Partial<MemoryRecord>): Promise<MemoryRecord | null> {
    // TODO: REAL S3 IMPLEMENTATION HERE
    await this.ensureLoaded();
    const current = this.data.memories.find((item) => item.id === memoryId);
    if (!current) return null;
    const updated = { ...current, ...patch };
    await this.saveMemory(updated);
    return updated;
  }

  public async queryMemories(query: MemoryQuery): Promise<MemoryRecord[]> {
    // TODO: REAL S3 IMPLEMENTATION HERE
    return this.getMemories(query);
  }

  public async saveCompressedPacket(packet: CompressedPacket): Promise<void> {
    // TODO: REAL S3 IMPLEMENTATION HERE
    await this.ensureLoaded();
    const index = this.data.packets.findIndex((item) => item.id === packet.id);
    if (index >= 0) this.data.packets[index] = packet;
    else this.data.packets.push(packet);
    await this.persist();
  }

  public async getTimeline(repo?: string): Promise<TimelineEvent[]> {
    // TODO: REAL S3 IMPLEMENTATION HERE
    await this.ensureLoaded();
    return this.data.timeline
      .filter((event) => !repo || event.repo === repo)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  public async saveArchitectureRule(rule: ArchitectureRule): Promise<void> {
    // TODO: REAL S3 IMPLEMENTATION HERE
    await this.ensureLoaded();
    const index = this.data.architectureRules.findIndex((item) => item.id === rule.id);
    if (index >= 0) this.data.architectureRules[index] = rule;
    else this.data.architectureRules.push(rule);
    await this.persist();
  }

  public async getArchitectureRules(repo?: string): Promise<ArchitectureRule[]> {
    // TODO: REAL S3 IMPLEMENTATION HERE
    await this.ensureLoaded();
    if (this.data.architectureRules.length === 0) {
      this.data.architectureRules.push(...this.defaultRemoteRules());
      await this.persist();
    }
    return this.data.architectureRules.filter((rule) => !repo || !rule.repo || rule.repo === repo);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.filePath(), 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedMemoryStore>;
      this.data = {
        schemaVersion: parsed.schemaVersion ?? 2,
        memories: parsed.memories ?? [],
        packets: parsed.packets ?? [],
        timeline: parsed.timeline ?? [],
        architectureRules: parsed.architectureRules ?? [],
      };
    } catch {
      this.data = { schemaVersion: 2, memories: [], packets: [], timeline: [], architectureRules: [] };
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await fs.mkdir(this.storageRoot, { recursive: true });
    await fs.writeFile(this.filePath(), JSON.stringify(this.data, null, 2), 'utf8');
  }

  private filePath(): string {
    return path.join(this.storageRoot, 'axiom-organizational-memory.mock-s3.json');
  }

  private applyQuery(memories: MemoryRecord[], query: MemoryQuery): MemoryRecord[] {
    const text = query.text?.toLowerCase();
    const tags = query.tags ?? [];
    return memories
      .filter((memory) => !query.repo || memory.repo === query.repo)
      .filter((memory) => !query.file || memory.file === query.file || memory.relatedEntities.some((entity) => entity.kind === 'file' && entity.label === query.file))
      .filter((memory) => !query.type || memory.type === query.type)
      .filter((memory) => !query.state || memory.state === query.state)
      .filter((memory) => tags.every((tag) => memory.tags.includes(tag)))
      .filter((memory) => !text || `${memory.summary} ${memory.tags.join(' ')}`.toLowerCase().includes(text))
      .sort((a, b) => b.confidence - a.confidence || b.timestamp.localeCompare(a.timestamp))
      .slice(0, query.limit ?? memories.length);
  }

  private upsertTimeline(memory: MemoryRecord): void {
    const event: TimelineEvent = {
      id: `timeline:${memory.id}`,
      repo: memory.repo,
      timestamp: memory.timestamp,
      title: memory.type.replace(/_/g, ' ').toLowerCase(),
      description: memory.summary,
      type: memory.type,
      provenance: memory.source,
    };
    const index = this.data.timeline.findIndex((item) => item.id === event.id);
    if (index >= 0) this.data.timeline[index] = event;
    else this.data.timeline.push(event);
  }

  private findDuplicate(memory: MemoryRecord): MemoryRecord | null {
    return (
      this.data.memories.find(
        (item) =>
          item.repo === memory.repo &&
          item.type === memory.type &&
          item.source.provider === memory.source.provider &&
          item.source.sourceId === memory.source.sourceId,
      ) ??
      this.data.memories.find(
        (item) =>
          item.repo === memory.repo &&
          item.type === memory.type &&
          item.file === memory.file &&
          item.summary.toLowerCase() === memory.summary.toLowerCase(),
      ) ??
      null
    );
  }

  private mergeMemory(existing: MemoryRecord, incoming: MemoryRecord): MemoryRecord {
    return {
      ...existing,
      ...incoming,
      id: existing.id,
      state: existing.state === 'CANONICAL' || incoming.state === 'CANONICAL' ? 'CANONICAL' : incoming.state,
      confidence: Math.max(existing.confidence, incoming.confidence),
      tags: [...new Set([...existing.tags, ...incoming.tags])],
      relatedEntities: [...existing.relatedEntities, ...incoming.relatedEntities].filter(
        (entity, index, all) => all.findIndex((candidate) => candidate.kind === entity.kind && candidate.id === entity.id && candidate.relation === entity.relation) === index,
      ),
      timestamp: incoming.timestamp > existing.timestamp ? incoming.timestamp : existing.timestamp,
    };
  }

  private defaultRemoteRules(): ArchitectureRule[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'remote-pricing-retry-policy',
        repo: 'pricing-service',
        scope: 'src/retry/**',
        expected: 'exponential backoff with jitter and max 3 retries',
        observedPatterns: ['fixed retry', 'fixed retries', 'no jitter', 'retry cap removed', 'while true retry'],
        severity: 'HIGH',
        description: 'Pricing retry policy must protect OMS and settlement from retry storms.',
        tags: ['retry', 'backoff', 'oms', 'vendor-throttle'],
        sourceType: 'REMOTE_CANONICAL',
        source: { provider: 'memory-store', sourceId: 'remote-pricing-retry-policy', label: 'Remote org rule: pricing retry policy' },
        updatedAt: now,
      },
      {
        id: 'remote-async-idempotency',
        scope: 'src/**',
        expected: 'async execution must be idempotent before fanout is enabled',
        observedPatterns: ['duplicate execution', 'double apply', 'async race', 'fanout without idempotency'],
        severity: 'HIGH',
        description: 'Async fanout cannot ship without idempotency guards because OMS-771 and settlement replay both failed here.',
        tags: ['async-risk', 'idempotency', 'duplicate-execution'],
        sourceType: 'REMOTE_CANONICAL',
        source: { provider: 'memory-store', sourceId: 'remote-async-idempotency', label: 'Remote org rule: async idempotency' },
        updatedAt: now,
      },
    ];
  }
}
