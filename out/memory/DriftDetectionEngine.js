"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriftDetectionEngine = void 0;
const utils_1 = require("../utils");
class DriftDetectionEngine {
    detect(repo, memories) {
        const text = memories.map((memory) => `${memory.summary} ${memory.tags.join(' ')}`).join(' ').toLowerCase();
        const drifts = [];
        if (text.includes('exponential') && text.includes('fixed retries')) {
            drifts.push(this.make(repo, 'exponential backoff', 'fixed retries', 'HIGH', 'Retry policy drift: declared exponential backoff but recent signal observed fixed retries.'));
        }
        if (text.includes('idempotency') && text.includes('async') && text.includes('duplicate')) {
            drifts.push(this.make(repo, 'idempotent async execution', 'duplicate execution risk remains active', 'HIGH', 'Async execution drift: idempotency intent exists but duplicate execution remains linked.'));
        }
        if (text.includes('architecture') && text.includes('todo')) {
            drifts.push(this.make(repo, 'documented architecture', 'unfinished TODO/FIXME near architectural code', 'MEDIUM', 'Architecture drift: implementation carries unresolved TODO near declared intent.'));
        }
        return drifts;
    }
    make(repo, expected, observed, severity, summary) {
        return {
            id: (0, utils_1.hashId)(`drift:${repo}:${expected}:${observed}`),
            type: 'DRIFT',
            repo,
            state: 'PROVISIONAL',
            summary,
            source: { provider: 'drift-engine', sourceId: `${expected}:${observed}`, label: 'Drift Detection Engine' },
            timestamp: new Date().toISOString(),
            confidence: severity === 'HIGH' ? 0.9 : 0.76,
            tags: ['drift', severity.toLowerCase(), expected, observed],
            relatedEntities: [],
            expected,
            observed,
            severity,
        };
    }
}
exports.DriftDetectionEngine = DriftDetectionEngine;
//# sourceMappingURL=DriftDetectionEngine.js.map