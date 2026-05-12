"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CavemanEngine = void 0;
const utils_1 = require("./utils");
class CavemanEngine {
    compress(input) {
        const result = [];
        for (const file of input.files.slice(0, 60)) {
            const intent = this.intentFromText(file.summary);
            const behavior = this.behaviorFromText(file.summary);
            const caveman = this.toCaveman(file.summary);
            result.push(this.makeSummary('file', file.path, caveman, intent, behavior, file.riskSignals, 'caveman'));
            result.push(this.makeSummary('file', file.path, file.summary, intent, behavior, file.riskSignals, 'developer'));
            result.push(this.makeSummary('file', file.path, `This file contributes to system behavior by ${behavior}. Intent centers on ${intent}.`, intent, behavior, file.riskSignals, 'system'));
        }
        for (const commit of input.commits.slice(0, 25)) {
            const intent = this.intentFromText(commit.message);
            const behavior = this.behaviorFromText(commit.message);
            result.push(this.makeSummary('commit', commit.hash, this.toCaveman(commit.message), intent, behavior, commit.riskSignals, 'caveman'));
            result.push(this.makeSummary('commit', commit.hash, commit.summary, intent, behavior, commit.riskSignals, 'developer'));
        }
        for (const pr of input.prs.slice(0, 12)) {
            const text = `${pr.title}. ${pr.summary}. Decision: ${pr.decision}. Risk: ${pr.risk}`;
            result.push(this.makeSummary('module', pr.id, this.toCaveman(text), pr.decision, pr.summary, [pr.risk], 'caveman'));
            result.push(this.makeSummary('module', pr.id, pr.summary, pr.decision, pr.summary, [pr.risk], 'developer'));
            result.push(this.makeSummary('module', pr.id, `System decision: ${pr.decision}. Operational risk: ${pr.risk}.`, pr.decision, pr.summary, [pr.risk], 'system'));
        }
        result.push(this.makeSummary('repo', 'repo-root', this.toCaveman(input.architectureSummary), 'Preserve operational resilience and shared understanding.', input.architectureSummary, [], 'caveman'));
        result.push(this.makeSummary('repo', 'repo-root', input.architectureSummary, 'Repository architecture intent.', input.architectureSummary, [], 'system'));
        return result;
    }
    makeSummary(sourceType, sourceId, text, intent, behavior, risks, level) {
        return {
            id: (0, utils_1.hashId)(`${sourceType}:${sourceId}:${level}:${text}`),
            level,
            sourceType,
            sourceId,
            text,
            intent,
            behavior,
            risks,
            vector: (0, utils_1.toMockEmbedding)(`${text} ${intent} ${behavior} ${risks.join(' ')}`),
        };
    }
    intentFromText(text) {
        const t = text.toLowerCase();
        if (t.includes('retry'))
            return 'increase resiliency against transient failures';
        if (t.includes('auth'))
            return 'enforce secure access and identity boundaries';
        if (t.includes('cache'))
            return 'reduce latency and repeated external calls';
        if (t.includes('queue'))
            return 'decouple synchronous pressure from downstream systems';
        return 'keep module behavior stable and understandable';
    }
    behaviorFromText(text) {
        const t = text.toLowerCase();
        if (t.includes('retry'))
            return 'retrying failures before escalation';
        if (t.includes('queue'))
            return 'routing overflow work to asynchronous processing';
        if (t.includes('validate'))
            return 'validating inputs before execution';
        return 'executing core service flow with moderate coupling';
    }
    toCaveman(text) {
        const lower = text.toLowerCase();
        const parts = [];
        if (lower.includes('payment'))
            parts.push('payment');
        if (lower.includes('auth'))
            parts.push('auth');
        if (lower.includes('retry'))
            parts.push('fail -> retry');
        if (lower.includes('queue'))
            parts.push('retry -> queue fallback');
        if (lower.includes('cache'))
            parts.push('cache -> fast path');
        if (lower.includes('latency'))
            parts.push('latency risk');
        if (parts.length === 0)
            parts.push('system change -> behavior shift');
        return parts.join(' | ');
    }
}
exports.CavemanEngine = CavemanEngine;
//# sourceMappingURL=compression.js.map