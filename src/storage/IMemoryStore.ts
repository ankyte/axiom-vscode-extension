import { CompressedPacket, MemoryQuery, MemoryRecord, TimelineEvent } from '../models/memory';

export interface IMemoryStore {
  saveMemory(memory: MemoryRecord): Promise<void>;
  getMemories(query?: MemoryQuery): Promise<MemoryRecord[]>;
  updateMemory(memoryId: string, patch: Partial<MemoryRecord>): Promise<MemoryRecord | null>;
  queryMemories(query: MemoryQuery): Promise<MemoryRecord[]>;
  saveCompressedPacket(packet: CompressedPacket): Promise<void>;
  getTimeline(repo?: string): Promise<TimelineEvent[]>;
}
