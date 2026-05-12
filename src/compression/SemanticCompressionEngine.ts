import { CompressedPacket, MemoryRecord } from '../models/memory';
import { ILLMProvider } from '../providers/ILLMProvider';

export class SemanticCompressionEngine {
  constructor(private readonly llm: ILLMProvider) {}

  public async compressText(input: string): Promise<string> {
    return this.llm.compressContext(input);
  }

  public async createPacket(memories: MemoryRecord[]): Promise<CompressedPacket> {
    return this.llm.generateContextPacket(memories);
  }
}
