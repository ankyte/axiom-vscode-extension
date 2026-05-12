"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextRetrievalEngine = void 0;
class ContextRetrievalEngine {
    constructor(store, embeddings, relationships, compression, risk, drift, timeline, getConnections) {
        this.store = store;
        this.embeddings = embeddings;
        this.relationships = relationships;
        this.compression = compression;
        this.risk = risk;
        this.drift = drift;
        this.timeline = timeline;
        this.getConnections = getConnections;
    }
    async retrieve(context) {
        const repoMemories = await this.store.getMemories({ repo: context.repo });
        const fileMemories = context.file ? await this.store.getMemories({ repo: context.repo, file: context.file }) : [];
        const semanticMatches = await this.embeddings.similaritySearch(context.query ?? `${context.repo} ${context.file ?? ''} retry incident rollback architecture`, repoMemories, 12);
        const combined = this.unique([...fileMemories, ...semanticMatches.map((match) => match.memory), ...repoMemories.slice(0, 20)]);
        const connections = await this.getConnections(context.repo);
        const connectedRepositories = this.relationships.connectedRepositories(context.repo, connections, combined);
        const drift = this.drift.detect(context.repo, combined);
        const packet = await this.compression.createPacket([...combined.slice(0, 16), ...drift]);
        await this.store.saveCompressedPacket(packet);
        return {
            repo: context.repo,
            file: context.file,
            historicalContext: combined.filter((memory) => memory.type === 'HISTORICAL_CONTEXT' || memory.type === 'TRIBAL_KNOWLEDGE').slice(0, 8),
            relatedIncidents: combined.filter((memory) => memory.type === 'INCIDENT' || memory.relatedEntities.some((entity) => entity.kind === 'incident')).slice(0, 8),
            architecturalIntent: combined.filter((memory) => memory.type === 'ARCHITECTURAL_INTENT').slice(0, 8),
            risks: this.risk.score(context.repo, combined, context.file),
            drift,
            compressedPacket: packet,
            connectedRepositories,
            timeline: this.timeline.build(combined).slice(-10),
        };
    }
    unique(memories) {
        const byId = new Map();
        for (const memory of memories)
            byId.set(memory.id, memory);
        return [...byId.values()].sort((a, b) => b.confidence - a.confidence || b.timestamp.localeCompare(a.timestamp));
    }
}
exports.ContextRetrievalEngine = ContextRetrievalEngine;
//# sourceMappingURL=ContextRetrievalEngine.js.map