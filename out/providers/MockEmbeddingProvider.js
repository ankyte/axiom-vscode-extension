"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockEmbeddingProvider = void 0;
const utils_1 = require("../utils");
class MockEmbeddingProvider {
    async generateEmbedding(text) {
        // TODO: REAL VECTOR DB IMPLEMENTATION HERE
        return (0, utils_1.toMockEmbedding)(text);
    }
    async similaritySearch(query, memories, limit) {
        // TODO: REAL VECTOR DB IMPLEMENTATION HERE
        const queryVector = await this.generateEmbedding(query);
        const queryTokens = new Set((0, utils_1.tokenize)(query));
        return memories
            .map((memory) => {
            const vectorScore = memory.embedding ? (0, utils_1.cosineSim)(queryVector, memory.embedding) : 0;
            const memoryTokens = new Set((0, utils_1.tokenize)(`${memory.summary} ${memory.tags.join(' ')}`));
            const overlap = [...queryTokens].filter((token) => memoryTokens.has(token)).length / Math.max(queryTokens.size, 1);
            return { memory, score: Number((vectorScore * 0.7 + overlap * 0.3).toFixed(4)) };
        })
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
}
exports.MockEmbeddingProvider = MockEmbeddingProvider;
//# sourceMappingURL=MockEmbeddingProvider.js.map