"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriftDetectionEngine = void 0;
const utils_1 = require("../utils");
class DriftDetectionEngine {
    detect(repo, memories, ruleSet) {
        const text = memories.map((memory) => `${memory.summary} ${memory.tags.join(' ')}`).join(' ').toLowerCase();
        const drifts = [];
        for (const rule of ruleSet?.rules ?? []) {
            const observed = this.observed(rule, text);
            if (observed) {
                drifts.push(this.makeFromRule(repo, rule, observed));
            }
        }
        if (text.includes('exponential') && text.includes('fixed retries')) {
            drifts.push(this.make(repo, 'exponential backoff', 'fixed retries', 'HIGH', 'Retry policy drift: declared exponential backoff but recent signal observed fixed retries.'));
        }
        if (text.includes('idempotency') && text.includes('async') && text.includes('duplicate')) {
            drifts.push(this.make(repo, 'idempotent async execution', 'duplicate execution risk remains active', 'HIGH', 'Async execution drift: idempotency intent exists but duplicate execution remains linked.'));
        }
        if (text.includes('architecture') && text.includes('todo')) {
            drifts.push(this.make(repo, 'documented architecture', 'unfinished TODO/FIXME near architectural code', 'MEDIUM', 'Architecture drift: implementation carries unresolved TODO near declared intent.'));
        }
        return this.unique(drifts);
    }
    observed(rule, text) {
        const matches = rule.observedPatterns.filter((pattern) => text.includes(pattern.toLowerCase()));
        return matches.length ? matches.join(', ') : null;
    }
    makeFromRule(repo, rule, observed) {
        return {
            id: (0, utils_1.hashId)(`drift:${repo}:${rule.id}:${observed}`),
            type: 'DRIFT',
            ruleId: rule.id,
            ruleSource: rule.sourceType,
            repo,
            state: rule.sourceType === 'REMOTE_CANONICAL' ? 'CANONICAL' : 'PROVISIONAL',
            summary: `Drift against ${rule.sourceType.toLowerCase().replace(/_/g, ' ')} rule: expected ${rule.expected}; observed ${observed}.`,
            source: { provider: 'drift-engine', sourceId: rule.id, label: `Drift rule: ${rule.source.label}` },
            timestamp: new Date().toISOString(),
            confidence: rule.sourceType === 'REMOTE_CANONICAL' ? 0.92 : 0.82,
            tags: ['drift', rule.severity.toLowerCase(), rule.sourceType.toLowerCase(), ...rule.tags],
            relatedEntities: [],
            expected: rule.expected,
            observed,
            severity: rule.severity,
        };
    }
    make(repo, expected, observed, severity, summary) {
        return {
            id: (0, utils_1.hashId)(`drift:${repo}:${expected}:${observed}`),
            type: 'DRIFT',
            ruleSource: 'HEURISTIC',
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
    unique(drifts) {
        const byKey = new Map();
        for (const drift of drifts) {
            const key = `${drift.expected}:${drift.observed}`;
            const existing = byKey.get(key);
            if (!existing || drift.confidence > existing.confidence) {
                byKey.set(key, drift);
            }
        }
        return [...byKey.values()].sort((a, b) => b.confidence - a.confidence);
    }
}
exports.DriftDetectionEngine = DriftDetectionEngine;
//# sourceMappingURL=DriftDetectionEngine.js.map