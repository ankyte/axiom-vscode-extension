import * as fs from 'fs/promises';
import * as path from 'path';
import { CompressedPacket, MemoryQuery, MemoryRecord, TimelineEvent } from '../models/memory';
import { IMemoryStore } from './IMemoryStore';

interface PersistedMemoryStore {
  memories: MemoryRecord[];
  packets: CompressedPacket[];
  timeline: TimelineEvent[];
}

export class MockS3MemoryStore implements IMemoryStore {
  private loaded = false;
  private data: PersistedMemoryStore = { memories: [], packets: [], timeline: [] };

  constructor(private readonly storageRoot: string) {}

  public async saveMemory(memory: MemoryRecord): Promise<void> {
    // TODO: REAL S3 IMPLEMENTATION HERE
    await this.ensureLoaded();
    const index = this.data.memories.findIndex((item) => item.id === memory.id);
    if (index >= 0) {
      this.data.memories[index] = memory;
    } else {
      this.data.memories.push(memory);
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

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.filePath(), 'utf8');
      this.data = JSON.parse(raw) as PersistedMemoryStore;
    } catch {
      this.data = { memories: [], packets: [], timeline: [] };
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
}
