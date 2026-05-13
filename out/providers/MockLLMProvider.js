"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockLLMProvider = void 0;
const utils_1 = require("../utils");
const FILLER = new Set([
    'the',
    'was',
    'were',
    'after',
    'before',
    'with',
    'from',
    'this',
    'that',
    'into',
    'because',
    'caused',
    'during',
    'should',
    'would',
    'could',
    'been',
    'being',
]);
const IMPORTANT = new Set([
    'retry',
    'retries',
    'rewrite',
    'rewritten',
    'rollback',
    'incident',
    'outage',
    'async',
    'race',
    'vendor',
    'throttle',
    'throttling',
    'duplicate',
    'idempotency',
    'settlement',
    'pricing',
    'oms',
    'backoff',
    'jitter',
    'hotfix',
    'drift',
]);
class MockLLMProvider {
    async compressContext(input) {
        // TODO: REAL ROCKAI IMPLEMENTATION HERE
        const tokens = (0, utils_1.tokenize)(input)
            .map((token) => this.normalize(token))
            .filter((token) => token.length > 2 && (!FILLER.has(token) || IMPORTANT.has(token)));
        const scored = tokens
            .map((token, index) => ({ token, index, score: (IMPORTANT.has(token) ? 4 : 1) + Math.max(0, 3 - index / 16) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 18)
            .sort((a, b) => a.index - b.index)
            .map((item) => item.token);
        return [...new Set(scored)].join(' ');
    }
    async summarizeIncident(input) {
        // TODO: REAL ROCKAI IMPLEMENTATION HERE
        const compact = await this.compressContext(input);
        return compact.includes('incident') ? compact : `incident ${compact}`;
    }
    async extractIntent(input) {
        // TODO: REAL ROCKAI IMPLEMENTATION HERE
        const lower = input.toLowerCase();
        if (lower.includes('retry') || lower.includes('backoff'))
            return 'preserve resilient retry behavior with bounded duplicate-execution risk';
        if (lower.includes('idempot'))
            return 'ensure repeated async execution cannot double-apply business effects';
        if (lower.includes('rollback'))
            return 'avoid reopening the regression that forced rollback';
        if (lower.includes('architecture'))
            return 'keep implementation aligned with declared architecture';
        return 'preserve organizational context while changing code';
    }
    async generateContextPacket(memories) {
        // TODO: REAL ROCKAI IMPLEMENTATION HERE
        const raw = memories.map((memory) => `${memory.summary} ${memory.tags.join(' ')}`).join('\n');
        const text = await this.compressContext(raw);
        const highConfidence = memories.filter((memory) => memory.confidence >= 0.8).length;
        return {
            id: (0, utils_1.hashId)(`packet:${raw}:${Date.now()}`),
            repo: memories[0]?.repo ?? 'unknown',
            file: memories.find((memory) => memory.file)?.file,
            createdAt: new Date().toISOString(),
            sourceMemoryIds: memories.map((memory) => memory.id),
            rawTokenEstimate: raw.split(/\s+/).filter(Boolean).length,
            compressedTokenEstimate: text.split(/\s+/).filter(Boolean).length,
            text,
            quality: highConfidence >= Math.ceil(memories.length / 2) ? 'HIGH' : 'MEDIUM',
            provenance: memories.map((memory) => memory.source),
        };
    }
    normalize(token) {
        if (token === 'retries')
            return 'retry';
        if (token === 'rewritten')
            return 'rewrite';
        if (token === 'throttling')
            return 'throttle';
        return token;
    }
}
exports.MockLLMProvider = MockLLMProvider;
//# sourceMappingURL=MockLLMProvider.js.map