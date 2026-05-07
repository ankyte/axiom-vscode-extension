import { AxiomMemory, CompressedSummary } from './types';
import { cosineSim, toMockEmbedding, topN } from './utils';

export class RetrievalEngine {
  public query(memory: AxiomMemory, query: string, level?: 'caveman' | 'developer' | 'system'): CompressedSummary[] {
    const vector = toMockEmbedding(query);
    const candidates = level ? memory.summaries.filter((s) => s.level === level) : memory.summaries;
    return topN(candidates, (s) => cosineSim(vector, s.vector), 8);
  }

  public contextPack(memory: AxiomMemory): string {
    const caveman = memory.summaries
      .filter((s) => s.level === 'caveman' && s.sourceType !== 'file')
      .slice(0, 6)
      .map((s) => `- ${s.text}`)
      .join('\n');

    return [
      'SYSTEM UNDERSTANDING:',
      `- ${memory.architecture.architectureSummary}`,
      ...memory.summaries
        .filter((s) => s.level === 'system' && s.sourceType === 'module')
        .slice(0, 3)
        .map((s) => `- ${s.text}`),
      '',
      'CAVEMAN SUMMARY:',
      caveman || '- no caveman summaries available',
      '',
      'KEY DECISIONS:',
      ...memory.keyDecisions.slice(0, 6).map((d) => `- ${d}`),
      '',
      'KNOWN RISKS:',
      ...memory.risks.slice(0, 6).map((r) => `- ${r}`),
      ...memory.auditorFindings.slice(0, 4).map((f) => `- [${f.severity}] ${f.statement}`),
      '',
      'AI REASONING SUMMARIES:',
      ...memory.aiReasoningSummaries.slice(0, 6).map((r) => `- ${r}`),
    ].join('\n');
  }

  public combinedOperationalContext(memory: AxiomMemory): string {
    return [
      this.contextPack(memory),
      '',
      'HISTORICAL AI DECISIONS:',
      ...memory.historicalAIDecisions.slice(0, 8).map((d) => `- ${d}`),
      '',
      'AI-DERIVED OPERATIONAL RISKS:',
      ...memory.aiDerivedRisks.slice(0, 8).map((r) => `- ${r}`),
      '',
      'IMPORTED AI CONTEXT:',
      ...memory.importedAIContext.slice(0, 8).map((c) => `- [${c.source}] ${c.what} | why: ${c.why} | impact: ${c.impact}`),
    ].join('\n');
  }
}
