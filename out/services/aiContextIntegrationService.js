"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIContextIntegrationService = void 0;
const utils_1 = require("../utils");
class AIContextIntegrationService {
    constructor(compressor) {
        this.compressor = compressor;
    }
    merge(memory, intents) {
        const aiCompressed = this.toCompressedSummaries(intents);
        const withoutOldAI = memory.summaries.filter((s) => s.sourceType !== 'ai_context');
        const summaries = [...withoutOldAI, ...aiCompressed];
        const aiNodes = intents.map((intent) => ({
            id: `ai:${intent.id}`,
            type: 'ai_context',
            label: `${intent.what} | ${intent.impact}`,
            meta: {
                source: intent.source,
                sessionId: intent.sessionId,
                timestamp: intent.timestamp,
            },
        }));
        const aiSummaryNodes = aiCompressed.map((summary) => ({
            id: `summary:${summary.id}`,
            type: 'summary',
            label: summary.text,
            meta: { source: 'copilot' },
        }));
        const aiEdges = [];
        for (const intent of intents) {
            for (const file of intent.referencedFiles) {
                aiEdges.push({ from: `ai:${intent.id}`, to: `file:${file}`, relation: 'related_to' });
            }
            for (const svc of intent.relatedServices) {
                aiEdges.push({ from: `ai:${intent.id}`, to: `service:${svc}`, relation: 'related_to' });
            }
        }
        const graphNodes = dedupeNodes([...memory.graph.nodes.filter((n) => n.type !== 'ai_context'), ...aiNodes, ...aiSummaryNodes]);
        const graphEdges = dedupeEdges([...memory.graph.edges.filter((e) => !e.from.startsWith('ai:')), ...aiEdges]);
        const importedContext = intents.map((intent) => ({
            id: intent.id,
            source: intent.source,
            sessionId: intent.sessionId,
            timestamp: intent.timestamp,
            what: intent.what,
            why: intent.why,
            impact: intent.impact,
            referencedFiles: intent.referencedFiles,
            relatedServices: intent.relatedServices,
            rawExcerpt: intent.rawExcerpt,
        }));
        const aiHistory = intents.map((i) => `${i.what} (why: ${i.why})`);
        const aiRisks = intents
            .filter((i) => /risk|latency|saturation|failure|timeout|coupling|stale|incident/i.test(`${i.impact} ${i.why}`))
            .map((i) => i.impact);
        return {
            ...memory,
            summaries,
            graph: { nodes: graphNodes, edges: graphEdges },
            importedAIContext: importedContext,
            historicalAIDecisions: dedupeStrings([...memory.historicalAIDecisions, ...aiHistory]).slice(0, 200),
            aiDerivedRisks: dedupeStrings([...memory.aiDerivedRisks, ...aiRisks]).slice(0, 200),
            aiReasoningSummaries: dedupeStrings([...memory.aiReasoningSummaries, ...intents.map((i) => i.impact)]).slice(0, 200),
            keyDecisions: dedupeStrings([...memory.keyDecisions, ...intents.map((i) => i.why)]).slice(0, 200),
            risks: dedupeStrings([...memory.risks, ...aiRisks]).slice(0, 300),
            lastIndexedAt: new Date().toISOString(),
        };
    }
    toCompressedSummaries(intents) {
        const fileLike = intents.map((intent) => ({
            path: `ai/${intent.source}/${intent.sessionId}/${intent.id}.md`,
            language: 'markdown',
            lines: 1,
            summary: `${intent.what}. ${intent.why}. ${intent.impact}.`,
            riskSignals: /risk|latency|failure|timeout|saturation|incident/i.test(`${intent.impact} ${intent.why}`)
                ? ['ai_derived_operational_risk']
                : [],
        }));
        const compressed = this.compressor.compress({
            files: fileLike,
            commits: [],
            prs: [],
            architectureSummary: intents.map((i) => `${i.what} ${i.impact}`).join(' | '),
        });
        return compressed.map((summary) => ({
            ...summary,
            id: (0, utils_1.hashId)(`ai:${summary.id}`),
            sourceType: 'ai_context',
            sourceId: summary.sourceId,
        }));
    }
}
exports.AIContextIntegrationService = AIContextIntegrationService;
function dedupeStrings(input) {
    return [...new Set(input.filter(Boolean))];
}
function dedupeNodes(nodes) {
    const map = new Map();
    for (const node of nodes)
        map.set(node.id, node);
    return [...map.values()];
}
function dedupeEdges(edges) {
    const map = new Map();
    for (const edge of edges)
        map.set(`${edge.from}|${edge.relation}|${edge.to}`, edge);
    return [...map.values()];
}
//# sourceMappingURL=aiContextIntegrationService.js.map