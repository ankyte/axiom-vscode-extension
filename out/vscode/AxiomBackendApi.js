"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AxiomBackendApi = void 0;
const path = __importStar(require("path"));
class AxiomBackendApi {
    constructor(kernel) {
        this.kernel = kernel;
    }
    async getMemoryTabData(activeFile) {
        const context = await this.retrieve(activeFile);
        return {
            activeFile: this.displayFile(context.file),
            historical: this.summaries(context.historicalContext, 6),
            intent: this.summaries(context.architecturalIntent, 6),
            timeline: context.timeline.map((event) => this.timelineRow(event)).slice(-6),
            related: [...new Set([...context.connectedRepositories, ...context.relatedIncidents.flatMap((memory) => memory.relatedEntities.map((entity) => entity.label))])].slice(0, 8),
        };
    }
    async getRiskTabData(activeFile) {
        const context = await this.retrieve(activeFile);
        const drift = context.drift[0];
        return {
            activeFile: this.displayFile(context.file),
            score: context.risks.score,
            regressions: [...context.risks.reasons, ...this.summaries(context.relatedIncidents, 4)].slice(0, 8),
            drift: {
                expected: drift?.expected ?? 'declared architecture memory',
                observed: drift?.observed ?? 'no major drift detected',
            },
            protected: this.protectedKnowledge(context.historicalContext),
            trace: context.risks.trace.map((source) => this.trace(source)).slice(0, 8),
        };
    }
    async getGraphTabData(activeFile) {
        const context = await this.retrieve(activeFile);
        const graph = await this.kernel.getGraph(context.repo);
        return {
            activeFile: this.displayFile(context.file),
            nodes: graph.nodes.slice(0, 24).map((node) => ({ id: node.id, label: node.label, kind: node.kind })),
            edges: graph.edges.slice(0, 36).map((edge) => ({ from: edge.from, to: edge.to, relation: edge.relation })),
            sharedContext: this.summaries([...context.relatedIncidents, ...context.architecturalIntent], 6),
            signals: `${graph.nodes.length} linked nodes\n${graph.edges.length} graph relationships\n${context.timeline.length} timeline events`,
            flow: this.flow(context.timeline),
        };
    }
    async getAITabData(activeFile) {
        const context = await this.retrieve(activeFile);
        return {
            activeFile: this.displayFile(context.file),
            compression: `${context.compressedPacket.rawTokenEstimate} -> ${context.compressedPacket.compressedTokenEstimate} tokens`,
            compressedMemory: context.compressedPacket.text || 'memory packet pending ingestion',
            quality: `${context.compressedPacket.quality} CONFIDENCE`,
            sources: [...new Set(context.compressedPacket.provenance.map((source) => source.label))].slice(0, 8),
        };
    }
    async getTabData(tab, activeFile) {
        if (tab === 'risks')
            return this.getRiskTabData(activeFile);
        if (tab === 'graph')
            return this.getGraphTabData(activeFile);
        if (tab === 'ai')
            return this.getAITabData(activeFile);
        return this.getMemoryTabData(activeFile);
    }
    async retrieve(activeFile) {
        const current = this.kernel.getActiveContext();
        const file = activeFile && activeFile !== 'No file selected' ? activeFile : current.file;
        return this.kernel.retrieve({ file });
    }
    summaries(memories, limit) {
        return memories.map((memory) => memory.summary).filter(Boolean).slice(0, limit);
    }
    timelineRow(event) {
        return {
            date: event.timestamp.slice(0, 10),
            event: event.title,
            desc: event.description,
        };
    }
    displayFile(file) {
        return file ? path.basename(file) : 'No file selected';
    }
    protectedKnowledge(memories) {
        const match = memories.find((memory) => /guard|quarter|rollback|duplicate|retry/i.test(memory.summary));
        return match?.summary ?? 'No protected operational knowledge found for this scope yet.';
    }
    trace(source) {
        return source.label || `${source.provider}:${source.sourceId}`;
    }
    flow(timeline) {
        const labels = timeline
            .map((event) => event.title)
            .filter((title, index, all) => all.indexOf(title) === index)
            .slice(-4);
        return labels.length ? labels.join(' -> ') : 'signals -> memory -> retrieval';
    }
}
exports.AxiomBackendApi = AxiomBackendApi;
//# sourceMappingURL=AxiomBackendApi.js.map