"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextRetrievalEngine = void 0;
class ContextRetrievalEngine {
    constructor(store, embeddings, relationships, compression, risk, drift, timeline, getConnections, getRuleSet) {
        this.store = store;
        this.embeddings = embeddings;
        this.relationships = relationships;
        this.compression = compression;
        this.risk = risk;
        this.drift = drift;
        this.timeline = timeline;
        this.getConnections = getConnections;
        this.getRuleSet = getRuleSet;
    }
    async retrieve(context) {
        const repoMemories = await this.store.getMemories({ repo: context.repo });
        const fileMemories = context.file ? await this.store.getMemories({ repo: context.repo, file: context.file }) : [];
        const semanticMatches = await this.embeddings.similaritySearch(context.query ?? `${context.repo} ${context.file ?? ''} retry incident rollback architecture`, repoMemories, 12);
        const combined = this.rank(this.unique([...fileMemories, ...semanticMatches.map((match) => match.memory), ...repoMemories.slice(0, 30)]), context);
        const [connections, ruleSet] = await Promise.all([this.getConnections(context.repo), this.getRuleSet(context.repo)]);
        const connectedRepositories = this.relationships.connectedRepositories(context.repo, connections, combined);
        const drift = this.drift.detect(context.repo, combined, ruleSet);
        for (const driftMemory of drift) {
            await this.store.saveMemory(driftMemory);
        }
        const packet = await this.compression.createPacket([...combined.slice(0, 16), ...drift]);
        await this.store.saveCompressedPacket(packet);
        return {
            repo: context.repo,
            file: context.file,
            historicalContext: combined.filter((memory) => memory.type === 'HISTORICAL_CONTEXT' || memory.type === 'TRIBAL_KNOWLEDGE').slice(0, 8),
            relatedIncidents: combined.filter((memory) => memory.type === 'INCIDENT' || memory.relatedEntities.some((entity) => entity.kind === 'incident')).slice(0, 8),
            architecturalIntent: combined.filter((memory) => memory.type === 'ARCHITECTURAL_INTENT').slice(0, 8),
            risks: this.risk.score(context.repo, [...combined, ...drift], context.file),
            drift,
            compressedPacket: packet,
            connectedRepositories,
            timeline: this.timeline.build(combined).slice(-10),
            ruleSources: ruleSet.sources,
            retrievalReasons: this.retrievalReasons(context, semanticMatches.map((match) => `${match.memory.source.label} (${match.score})`), ruleSet),
            lastUpdatedAt: new Date().toISOString(),
        };
    }
    unique(memories) {
        const byId = new Map();
        for (const memory of memories)
            byId.set(memory.id, memory);
        return [...byId.values()].sort((a, b) => b.confidence - a.confidence || b.timestamp.localeCompare(a.timestamp));
    }
    rank(memories, context) {
        const now = Date.now();
        return [...memories].sort((a, b) => this.score(b, context, now) - this.score(a, context, now));
    }
    score(memory, context, now) {
        const ageDays = Math.max(0, (now - Date.parse(memory.timestamp || new Date().toISOString())) / 86400000);
        const recency = Math.max(0, 1 - ageDays / 365);
        const fileBoost = context.file && (memory.file === context.file || memory.relatedEntities.some((entity) => entity.kind === 'file' && entity.label === context.file)) ? 0.22 : 0;
        const canonicalBoost = memory.state === 'CANONICAL' ? 0.14 : memory.state === 'PROVISIONAL' ? 0.07 : 0;
        const riskBoost = memory.tags.some((tag) => ['incident', 'rollback', 'hotfix', 'drift', 'duplicate-execution'].includes(tag)) ? 0.18 : 0;
        return memory.confidence * 0.55 + recency * 0.12 + fileBoost + canonicalBoost + riskBoost;
    }
    retrievalReasons(context, matches, ruleSet) {
        return [
            `metadata scope: repo=${context.repo}${context.file ? ` file=${context.file}` : ''}`,
            `semantic matches: ${matches.slice(0, 3).join(', ') || 'none'}`,
            `rule sources: ${ruleSet.sources.join(', ') || 'none'}`,
        ];
    }
}
exports.ContextRetrievalEngine = ContextRetrievalEngine;
//# sourceMappingURL=ContextRetrievalEngine.js.map