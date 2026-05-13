import { Provenance, RiskLevel } from './memory';

export type ArchitectureRuleSource = 'REMOTE_CANONICAL' | 'LOCAL_OVERRIDE' | 'INFERRED_DOCS' | 'AXIOM_DEFAULT';

export interface ArchitectureRule {
  id: string;
  repo?: string;
  scope?: string;
  expected: string;
  observedPatterns: string[];
  severity: RiskLevel;
  description: string;
  tags: string[];
  sourceType: ArchitectureRuleSource;
  source: Provenance;
  updatedAt: string;
}

export interface ArchitectureRuleSet {
  repo: string;
  rules: ArchitectureRule[];
  sources: ArchitectureRuleSource[];
  loadedAt: string;
}
