"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryExtractionEngine = void 0;
const utils_1 = require("../utils");
class MemoryExtractionEngine {
    constructor(embeddings, llm) {
        this.embeddings = embeddings;
        this.llm = llm;
    }
    async extract(signal) {
        const type = this.detectType(signal);
        const state = this.detectState(signal);
        const summary = await this.summarize(signal, type);
        const relatedEntities = this.relatedEntities(signal);
        const confidence = this.confidence(signal, type);
        const memory = {
            id: (0, utils_1.hashId)(`${signal.id}:${type}:${summary}`),
            type,
            repo: signal.repo,
            file: signal.file,
            branch: signal.branch,
            state,
            summary,
            source: signal.source,
            timestamp: signal.timestamp,
            confidence,
            tags: [...new Set([...signal.riskTags, ...signal.keywords.filter((keyword) => this.highSignal(keyword)).slice(0, 8)])],
            relatedEntities,
            rawSignalId: signal.id,
        };
        memory.embedding = await this.embeddings.generateEmbedding(`${memory.summary} ${memory.tags.join(' ')}`);
        return [memory];
    }
    detectType(signal) {
        if (signal.type === 'INCIDENT_LINKED')
            return 'INCIDENT';
        if (signal.type === 'ROLLBACK_DETECTED' || signal.riskTags.includes('rollback'))
            return 'REGRESSION';
        if (signal.type === 'PR_MERGED' && signal.riskTags.includes('incident'))
            return 'HISTORICAL_CONTEXT';
        if (signal.type === 'ARCHITECTURE_FILE_CHANGED' || signal.riskTags.includes('retry'))
            return 'ARCHITECTURAL_INTENT';
        if (signal.type === 'TODO_DETECTED')
            return 'TRIBAL_KNOWLEDGE';
        if (signal.type === 'DEPENDENCY_CHANGE')
            return 'RELATIONSHIP';
        return signal.type.startsWith('LOCAL') ? 'TRIBAL_KNOWLEDGE' : 'HISTORICAL_CONTEXT';
    }
    detectState(signal) {
        if (signal.type === 'LOCAL_COMMIT' || signal.type === 'FILE_OPENED' || signal.type === 'TODO_DETECTED')
            return 'PROVISIONAL';
        if (signal.type === 'PR_MERGED')
            return 'CANONICAL';
        if (signal.type === 'PR_CREATED' || signal.type === 'PR_COMMENT')
            return 'PROVISIONAL';
        return 'CANONICAL';
    }
    async summarize(signal, type) {
        const text = `${signal.title}. ${signal.body}`;
        if (type === 'INCIDENT')
            return this.sentence(await this.llm.summarizeIncident(text));
        if (type === 'ARCHITECTURAL_INTENT')
            return this.sentence(await this.llm.extractIntent(text));
        if (type === 'REGRESSION')
            return this.sentence(`Regression: ${await this.llm.compressContext(text)}`);
        return this.sentence(await this.llm.compressContext(text));
    }
    relatedEntities(signal) {
        return [
            ...signal.entities.repositories.filter((repo) => repo !== signal.repo).map((repo) => ({ kind: 'repo', id: repo, label: repo, relation: 'mentions_repo' })),
            ...signal.entities.files.map((file) => ({ kind: 'file', id: file, label: file, relation: 'touches_file' })),
            ...signal.entities.incidents.map((id) => ({ kind: 'incident', id, label: `Incident #${id}`, relation: 'linked_incident' })),
            ...signal.entities.pullRequests.map((id) => ({ kind: 'pr', id, label: `PR #${id}`, relation: 'linked_pr' })),
            ...signal.entities.commits.map((id) => ({ kind: 'commit', id, label: `Commit ${id}`, relation: 'linked_commit' })),
            ...signal.entities.dependencies.map((id) => ({ kind: 'dependency', id, label: id, relation: 'depends_on' })),
        ];
    }
    confidence(signal, type) {
        let score = signal.source.provider === 'azure-devops' ? 0.76 : 0.62;
        if (signal.riskTags.includes('incident'))
            score += 0.12;
        if (signal.riskTags.includes('rollback'))
            score += 0.1;
        if (type === 'ARCHITECTURAL_INTENT')
            score += 0.06;
        if (signal.entities.incidents.length > 0 || signal.entities.pullRequests.length > 0)
            score += 0.05;
        return Math.min(0.98, Number(score.toFixed(2)));
    }
    highSignal(keyword) {
        return ['retry', 'rollback', 'incident', 'outage', 'async', 'race', 'pricing', 'settlement', 'vendor', 'throttle', 'idempotency', 'duplicate', 'backoff'].includes(keyword);
    }
    sentence(text) {
        const trimmed = text.trim();
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
}
exports.MemoryExtractionEngine = MemoryExtractionEngine;
//# sourceMappingURL=MemoryExtractionEngine.js.map