export type SummaryLevel = 'caveman' | 'developer' | 'system';

export interface FileInsight {
  path: string;
  language: string;
  lines: number;
  summary: string;
  riskSignals: string[];
}

export interface CommitInsight {
  hash: string;
  author: string;
  date: string;
  message: string;
  summary: string;
  riskSignals: string[];
}

export interface PRInsight {
  id: string;
  title: string;
  summary: string;
  decision: string;
  risk: string;
}

export interface CompressedSummary {
  id: string;
  level: SummaryLevel;
  sourceType: 'file' | 'commit' | 'module' | 'repo' | 'ai_context';
  sourceId: string;
  text: string;
  intent: string;
  behavior: string;
  risks: string[];
  vector: number[];
}

export interface GraphNode {
  id: string;
  type: 'file' | 'commit' | 'service' | 'summary' | 'ai_context';
  label: string;
  meta?: Record<string, string>;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: 'affects' | 'introduced_by' | 'related_to';
}

export interface ArchitectureSnapshot {
  services: string[];
  entrypoints: string[];
  dependencies: string[];
  architectureSummary: string;
}

export interface RiskAuditFinding {
  severity: 'low' | 'medium' | 'high';
  statement: string;
  evidence: string;
}

export interface AxiomMemory {
  repoRoot: string;
  lastIndexedAt: string;
  architecture: ArchitectureSnapshot;
  files: FileInsight[];
  commits: CommitInsight[];
  prs: PRInsight[];
  summaries: CompressedSummary[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  keyDecisions: string[];
  risks: string[];
  auditorFindings: RiskAuditFinding[];
  importedAIContext: {
    id: string;
    source: 'copilot' | 'windsurf' | 'markdown';
    sessionId: string;
    timestamp: string;
    what: string;
    why: string;
    impact: string;
    referencedFiles: string[];
    relatedServices: string[];
    rawExcerpt: string;
  }[];
  historicalAIDecisions: string[];
  aiDerivedRisks: string[];
  aiReasoningSummaries: string[];
}
