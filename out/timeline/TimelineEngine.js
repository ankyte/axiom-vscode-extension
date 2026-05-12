"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimelineEngine = void 0;
class TimelineEngine {
    build(memories) {
        return memories
            .map((memory) => ({
            id: `timeline:${memory.id}`,
            repo: memory.repo,
            timestamp: memory.timestamp,
            title: this.title(memory),
            description: memory.summary,
            type: memory.type,
            provenance: memory.source,
        }))
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }
    title(memory) {
        if (memory.type === 'INCIDENT')
            return 'incident';
        if (memory.type === 'REGRESSION')
            return 'rollback/regression';
        if (memory.type === 'ARCHITECTURAL_INTENT')
            return 'architecture intent';
        if (memory.type === 'DRIFT')
            return 'drift detected';
        return 'memory captured';
    }
}
exports.TimelineEngine = TimelineEngine;
//# sourceMappingURL=TimelineEngine.js.map