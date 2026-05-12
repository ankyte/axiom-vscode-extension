import { MemoryRecord } from '../models/memory';

export interface SimilarityMatch {
  memory: MemoryRecord;
  score: number;
}

export interface IEmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  similaritySearch(query: string, memories: MemoryRecord[], limit: number): Promise<SimilarityMatch[]>;
}
