"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionPipeline = void 0;
class IngestionPipeline {
    constructor(normalizer, extractor, store) {
        this.normalizer = normalizer;
        this.extractor = extractor;
        this.store = store;
    }
    async ingest(signals) {
        const memories = [];
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
exports.IngestionPipeline = IngestionPipeline;
//# sourceMappingURL=IngestionPipeline.js.map