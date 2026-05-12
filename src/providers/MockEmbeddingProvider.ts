import { MemoryRecord } from '../models/memory';
import { cosineSim, toMockEmbedding, tokenize } from '../utils';
import { IEmbeddingProvider, SimilarityMatch } from './IEmbeddingProvider';

export class MockEmbeddingProvider implements IEmbeddingProvider {
  public async generateEmbedding(text: string): Promise<number[]> {
    // TODO: REAL VECTOR DB IMPLEMENTATION HERE
    return toMockEmbedding(text);
  }

  public async similaritySearch(query: string, memories: MemoryRecord[], limit: number): Promise<SimilarityMatch[]> {
    // TODO: REAL VECTOR DB IMPLEMENTATION HERE
    const queryVector = await this.generateEmbedding(query);
    const queryTokens = new Set(tokenize(query));
    return memories
      .map((memory) => {
        const vectorScore = memory.embedding ? cosineSim(queryVector, memory.embedding) : 0;
        const memoryTokens = new Set(tokenize(`${memory.summary} ${memory.tags.join(' ')}`));
        const overlap = [...queryTokens].filter((token) => memoryTokens.has(token)).length / Math.max(queryTokens.size, 1);
        return { memory, score: Number((vectorScore * 0.7 + overlap * 0.3).toFixed(4)) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
