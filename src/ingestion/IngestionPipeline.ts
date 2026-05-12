import { MemoryRecord } from '../models/memory';
import { EngineeringSignal } from '../models/signals';
import { MemoryExtractionEngine } from '../memory/MemoryExtractionEngine';
import { IMemoryStore } from '../storage/IMemoryStore';
import { SignalNormalizer } from './SignalNormalizer';

export class IngestionPipeline {
  constructor(
    private readonly normalizer: SignalNormalizer,
    private readonly extractor: MemoryExtractionEngine,
    private readonly store: IMemoryStore,
  ) {}

  public async ingest(signals: EngineeringSignal[]): Promise<MemoryRecord[]> {
    const memories: MemoryRecord[] = [];
    for (const signal of signals) {
      const normalized = this.normalizer.normalize(signal);
      const extracted = await this.extractor.extract(normalized);
      for (const memory of extracted) {
        await this.store.saveMemory(memory);
        memories.push(memory);
      }
    }
    return memories;
  }
}
