export type MemoryState = 'LOCAL' | 'PROVISIONAL' | 'CANONICAL';

export type MemoryType =
  | 'HISTORICAL_CONTEXT'
  | 'INCIDENT'
  | 'ARCHITECTURAL_INTENT'
  | 'REGRESSION'
  | 'DRIFT'
  | 'TRIBAL_KNOWLEDGE'
  | 'RELATIONSHIP'
  | 'COMPRESSED_PACKET';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Provenance {
  provider: 'local' | 'azure-devops' | 'memory-store' | 'relationship-engine' | 'drift-engine' | 'compression-engine';
  sourceId: string;
  label: string;
  url?: string;
}

export interface RelatedEntity {
  kind: 'repo' | 'file' | 'incident' | 'pr' | 'commit' | 'work-item' | 'dependency' | 'tag';
  id: string;
  label: string;
  relation: string;
}

export interface MemoryRecord {
  id: string;
  type: MemoryType;
  repo: string;
  file?: string;
  branch?: string;
  state: MemoryState;
  summary: string;
  source: Provenance;
  timestamp: string;
  confidence: number;
  tags: string[];
  relatedEntities: RelatedEntity[];
  embedding?: number[];
  rawSignalId?: string;
}

export interface CompressedPacket {
  id: string;
  repo: string;
  file?: string;
  createdAt: string;
  sourceMemoryIds: string[];
  rawTokenEstimate: number;
  compressedTokenEstimate: number;
  text: string;
  quality: RiskLevel;
  provenance: Provenance[];
}

export interface MemoryQuery {
  repo?: string;
  file?: string;
  type?: MemoryType;
  state?: MemoryState;
  tags?: string[];
  text?: string;
  limit?: number;
}

export interface TimelineEvent {
  id: string;
  repo: string;
  timestamp: string;
  title: string;
  description: string;
  type: MemoryType;
  provenance: Provenance;
}

export interface DriftMemory extends MemoryRecord {
  type: 'DRIFT';
  expected: string;
  observed: string;
  severity: RiskLevel;
}

export interface RetrievalContext {
  repo: string;
  file?: string;
  branch?: string;
  query?: string;
}

export interface RiskReport {
  repo: string;
  file?: string;
  score: RiskLevel;
  reasons: string[];
  trace: Provenance[];
  factors: {
    rollbackFrequency: number;
    incidentLinks: number;
    todoDensity: number;
    fileChurn: number;
    hotfixMentions: number;
  };
}

export interface ContextRetrievalResult {
  repo: string;
  file?: string;
  historicalContext: MemoryRecord[];
  relatedIncidents: MemoryRecord[];
  architecturalIntent: MemoryRecord[];
  risks: RiskReport;
  drift: DriftMemory[];
  compressedPacket: CompressedPacket;
  connectedRepositories: string[];
  timeline: TimelineEvent[];
}
