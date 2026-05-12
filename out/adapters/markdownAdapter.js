"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownAdapter = void 0;
class MarkdownAdapter {
    constructor() {
        this.source = 'markdown';
    }
    async discoverSessions() {
        return [];
    }
    async extractChunks(_limit = 200, _workspaceRoot) {
        return [];
    }
}
exports.MarkdownAdapter = MarkdownAdapter;
//# sourceMappingURL=markdownAdapter.js.map