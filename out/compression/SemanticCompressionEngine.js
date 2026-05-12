"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticCompressionEngine = void 0;
class SemanticCompressionEngine {
    constructor(llm) {
        this.llm = llm;
    }
    async compressText(input) {
        return this.llm.compressContext(input);
    }
    async createPacket(memories) {
        return this.llm.generateContextPacket(memories);
    }
}
exports.SemanticCompressionEngine = SemanticCompressionEngine;
//# sourceMappingURL=SemanticCompressionEngine.js.map