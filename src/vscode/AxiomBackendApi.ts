import * as path from 'path';
import { AxiomKernel } from '../core/AxiomKernel';
import { ContextRetrievalResult, MemoryRecord, Provenance, TimelineEvent } from '../models/memory';

export type SidebarTab = 'memory' | 'risks' | 'graph' | 'ai';

export interface MemoryTabData {
  activeFile: string;
  status: string[];
  historical: string[];
  intent: string[];
  timeline: { date: string; event: string; desc: string }[];
  related: string[];
  retrievalReasons: string[];
}

export interface RiskTabData {
  activeFile: string;
  score: 'LOW' | 'MEDIUM' | 'HIGH';
  regressions: string[];
  drift: { expected: string; observed: string; source?: string };
  protected: string;
  trace: string[];
  ruleSources: string[];
}

export interface GraphTabData {
  activeFile: string;
  nodes: { id: string; label: string; kind: string }[];
  edges: { from: string; to: string; relation: string }[];
  sharedContext: string[];
  signals: string;
  flow: string;
  connectedRepositories: string[];
}

export interface AITabData {
  activeFile: string;
  compression: string;
  compressedMemory: string;
  quality: string;
  sources: string[];
  retrievalReasons: string[];
}

export type SidebarTabData = MemoryTabData | RiskTabData | GraphTabData | AITabData;

export class AxiomBackendApi {
  constructor(private readonly kernel: AxiomKernel) {}

  public async getMemoryTabData(activeFile?: string): Promise<MemoryTabData> {
    const context = await this.retrieve(activeFile);
    return {
      activeFile: this.displayFile(context.file),
      status: this.statusLines(),
      historical: this.summaries(context.historicalContext, 6),
      intent: this.summaries(context.architecturalIntent, 6),
      timeline: context.timeline.map((event) => this.timelineRow(event)).slice(-6),
      related: [...new Set([...context.connectedRepositories, ...context.relatedIncidents.flatMap((memory) => memory.relatedEntities.map((entity) => entity.label))])].slice(0, 8),
      retrievalReasons: context.retrievalReasons,
    };
  }

  public async getRiskTabData(activeFile?: string): Promise<RiskTabData> {
    const context = await this.retrieve(activeFile);
    const drift = context.drift[0];
    return {
      activeFile: this.displayFile(context.file),
      score: context.risks.score,
      regressions: [...context.risks.reasons, ...this.summaries(context.relatedIncidents, 4)].slice(0, 8),
      drift: {
        expected: drift?.expected ?? 'declared architecture memory',
        observed: drift?.observed ?? 'no major drift detected',
        source: drift?.ruleSource,
      },
      protected: this.protectedKnowledge(context.historicalContext),
      trace: context.risks.trace.map((source) => this.trace(source)).slice(0, 8),
      ruleSources: context.ruleSources,
    };
  }

  public async getGraphTabData(activeFile?: string): Promise<GraphTabData> {
    const context = await this.retrieve(activeFile);
    const graph = await this.kernel.getGraph(context.repo);
    return {
      activeFile: this.displayFile(context.file),
      nodes: graph.nodes.slice(0, 24).map((node) => ({ id: node.id, label: node.label, kind: node.kind })),
      edges: graph.edges.slice(0, 36).map((edge) => ({ from: edge.from, to: edge.to, relation: edge.relation })),
      sharedContext: this.summaries([...context.relatedIncidents, ...context.architecturalIntent], 6),
      signals: `${graph.nodes.length} linked nodes\n${graph.edges.length} graph relationships\n${context.timeline.length} timeline events`,
      flow: this.flow(context.timeline),
      connectedRepositories: context.connectedRepositories,
    };
  }

  public async getAITabData(activeFile?: string): Promise<AITabData> {
    const context = await this.retrieve(activeFile);
    return {
      activeFile: this.displayFile(context.file),
      compression: `${context.compressedPacket.rawTokenEstimate} -> ${context.compressedPacket.compressedTokenEstimate} tokens`,
      compressedMemory: context.compressedPacket.text || 'memory packet pending ingestion',
      quality: `${context.compressedPacket.quality} CONFIDENCE`,
      sources: [...new Set(context.compressedPacket.provenance.map((source) => source.label))].slice(0, 8),
      retrievalReasons: context.retrievalReasons,
    };
  }

  public async getTabData(tab: SidebarTab, activeFile?: string): Promise<SidebarTabData> {
    if (tab === 'risks') return this.getRiskTabData(activeFile);
    if (tab === 'graph') return this.getGraphTabData(activeFile);
    if (tab === 'ai') return this.getAITabData(activeFile);
    return this.getMemoryTabData(activeFile);
  }

  public async getAIContextMarkdown(activeFile?: string): Promise<string> {
    const context = await this.retrieve(activeFile);
    return [
      '# AXIOM AI Context Packet',
      '',
      `Scope: ${context.repo}${context.file ? ` / ${context.file}` : ''}`,
      `Generated: ${this.shortTime(context.lastUpdatedAt)}`,
      '',
      '## Compressed Memory',
      context.compressedPacket.text || 'No compressed packet available yet.',
      '',
      '## Architectural Intent',
      ...this.summaries(context.architecturalIntent, 6).map((item) => `- ${item}`),
      '',
      '## Historical Context',
      ...this.summaries(context.historicalContext, 6).map((item) => `- ${item}`),
      '',
      '## Risks And Drift',
      `- Risk score: ${context.risks.score}`,
      ...context.risks.reasons.map((item) => `- ${item}`),
      ...context.drift.slice(0, 4).map((drift) => `- Drift: expected ${drift.expected}; observed ${drift.observed}; source ${drift.ruleSource ?? 'unknown'}`),
      '',
      '## Connected Repositories',
      ...(context.connectedRepositories.length ? context.connectedRepositories.map((repo) => `- ${repo}`) : ['- none']),
      '',
      '## Retrieval Explanation',
      ...context.retrievalReasons.map((reason) => `- ${reason}`),
      '',
      '## Sources',
      ...[...new Set(context.compressedPacket.provenance.map((source) => this.trace(source)))].map((source) => `- ${source}`),
    ].join('\n');
  }

  public async getAIComparisonMarkdown(activeFile?: string): Promise<string> {
    const context = await this.retrieve(activeFile);
    const rawLines = [
      ...this.summaries(context.historicalContext, 8),
      ...this.summaries(context.architecturalIntent, 8),
      ...context.relatedIncidents.slice(0, 6).map((memory) => memory.summary),
      ...context.drift.slice(0, 4).map((drift) => `Drift: expected ${drift.expected}; observed ${drift.observed}`),
    ];
    return [
      '# AXIOM Raw vs Compressed Context',
      '',
      `Scope: ${context.repo}${context.file ? ` / ${context.file}` : ''}`,
      '',
      '## Raw Retrieved Memory',
      ...(rawLines.length ? rawLines.map((line) => `- ${line}`) : ['- No raw retrieved memory available yet.']),
      '',
      '## AXIOM Compressed Packet',
      context.compressedPacket.text || 'No compressed packet available yet.',
      '',
      '## Compression',
      `${context.compressedPacket.rawTokenEstimate} -> ${context.compressedPacket.compressedTokenEstimate} tokens`,
      '',
      '## Why These Memories',
      ...context.retrievalReasons.map((reason) => `- ${reason}`),
    ].join('\n');
  }

  private async retrieve(activeFile?: string): Promise<ContextRetrievalResult> {
    const current = this.kernel.getActiveContext();
    const file = activeFile && activeFile !== 'No file selected' ? activeFile : current.file;
    return this.kernel.retrieve({ file });
  }

  private summaries(memories: MemoryRecord[], limit: number): string[] {
    return memories.map((memory) => memory.summary).filter(Boolean).slice(0, limit);
  }

  private timelineRow(event: TimelineEvent): { date: string; event: string; desc: string } {
    return {
      date: event.timestamp.slice(0, 10),
      event: event.title,
      desc: event.description,
    };
  }

  private displayFile(file?: string): string {
    return file ? path.basename(file) : 'No file selected';
  }

  private protectedKnowledge(memories: MemoryRecord[]): string {
    const match = memories.find((memory) => /guard|quarter|rollback|duplicate|retry/i.test(memory.summary));
    return match?.summary ?? 'No protected operational knowledge found for this scope yet.';
  }

  private trace(source: Provenance): string {
    return source.label || `${source.provider}:${source.sourceId}`;
  }

  private flow(timeline: TimelineEvent[]): string {
    const labels = timeline
      .map((event) => event.title)
      .filter((title, index, all) => all.indexOf(title) === index)
      .slice(-4);
    return labels.length ? labels.join(' -> ') : 'signals -> memory -> retrieval';
  }

  private statusLines(): string[] {
    const status = this.kernel.getStatus();
    return [
      status.lastLocalIngestAt ? `local sync ${this.shortTime(status.lastLocalIngestAt)}` : 'local sync pending',
      status.lastRemotePollAt ? `remote poll ${this.shortTime(status.lastRemotePollAt)}` : 'remote poll pending',
      status.lastRuleRefreshAt ? `rules refreshed ${this.shortTime(status.lastRuleRefreshAt)}` : 'rules pending',
      `${status.connectedRepositories.length} connected repos`,
    ];
  }

  private shortTime(value: string): string {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
