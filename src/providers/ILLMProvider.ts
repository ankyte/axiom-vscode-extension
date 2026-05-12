import { CompressedPacket, MemoryRecord } from '../models/memory';

export interface ILLMProvider {
  compressContext(input: string): Promise<string>;
  summarizeIncident(input: string): Promise<string>;
  extractIntent(input: string): Promise<string>;
  generateContextPacket(memories: MemoryRecord[]): Promise<CompressedPacket>;
}
