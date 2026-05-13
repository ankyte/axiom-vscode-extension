import * as fs from 'fs/promises';
import * as path from 'path';
import { ArchitectureRule, ArchitectureRuleSet } from '../models/architectureRules';
import { IMemoryStore } from '../storage/IMemoryStore';
import { hashId } from '../utils';

export class ArchitectureRuleProvider {
  constructor(private readonly store: IMemoryStore, private readonly workspaceRoot?: string) {}

  public async getRules(repo: string): Promise<ArchitectureRuleSet> {
    const remote = await this.store.getArchitectureRules(repo);
    const local = this.workspaceRoot ? await this.localOverrides(repo, this.workspaceRoot) : [];
    const inferred = this.workspaceRoot ? await this.inferredFromDocs(repo, this.workspaceRoot) : [];
    const defaults = this.defaultRules(repo);
    const rules = this.resolvePrecedence([...remote, ...local, ...inferred, ...defaults]);
    return {
      repo,
      rules,
      sources: [...new Set(rules.map((rule) => rule.sourceType))],
      loadedAt: new Date().toISOString(),
    };
  }

  private async localOverrides(repo: string, workspaceRoot: string): Promise<ArchitectureRule[]> {
    const file = path.join(workspaceRoot, '.axiom', 'architecture-rules.json');
    const raw = await fs.readFile(file, 'utf8').catch(() => '');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Partial<ArchitectureRule>[];
      return parsed.map((rule, index) => ({
        id: rule.id ?? hashId(`local-rule:${repo}:${index}:${rule.expected}`),
        repo: rule.repo ?? repo,
        scope: rule.scope,
        expected: rule.expected ?? 'repo-local architecture rule',
        observedPatterns: rule.observedPatterns ?? [],
        severity: rule.severity ?? 'MEDIUM',
        description: rule.description ?? rule.expected ?? 'Repo-local AXIOM architecture rule',
        tags: rule.tags ?? ['local-rule'],
        sourceType: 'LOCAL_OVERRIDE',
        source: { provider: 'local', sourceId: '.axiom/architecture-rules.json', label: 'Repo override: .axiom/architecture-rules.json' },
        updatedAt: rule.updatedAt ?? new Date().toISOString(),
      }));
    } catch {
      return [
        {
          id: hashId(`malformed-local-rule:${repo}`),
          repo,
          expected: 'valid architecture rule JSON',
          observedPatterns: ['malformed architecture-rules.json'],
          severity: 'MEDIUM',
          description: 'AXIOM could not parse repo-local architecture rules.',
          tags: ['local-rule', 'malformed-rule'],
          sourceType: 'LOCAL_OVERRIDE',
          source: { provider: 'local', sourceId: '.axiom/architecture-rules.json', label: 'Malformed repo architecture rules' },
          updatedAt: new Date().toISOString(),
        },
      ];
    }
  }

  private async inferredFromDocs(repo: string, workspaceRoot: string): Promise<ArchitectureRule[]> {
    const docs = await Promise.all(['docs/architecture.md', 'README.md'].map(async (rel) => ({ rel, content: await fs.readFile(path.join(workspaceRoot, rel), 'utf8').catch(() => '') })));
    const rules: ArchitectureRule[] = [];
    for (const doc of docs.filter((item) => item.content)) {
      const lower = doc.content.toLowerCase();
      if (lower.includes('exponential backoff') || lower.includes('jitter')) {
        rules.push(this.inferred(repo, doc.rel, 'exponential backoff with jitter', ['fixed retry', 'fixed retries', 'no jitter'], ['retry', 'backoff']));
      }
      if (lower.includes('idempot')) {
        rules.push(this.inferred(repo, doc.rel, 'idempotent async execution', ['duplicate execution', 'double apply', 'async race'], ['idempotency', 'async-risk']));
      }
      if (lower.includes('architecture') && (lower.includes('todo') || lower.includes('fixme'))) {
        rules.push(this.inferred(repo, doc.rel, 'architecture docs should not contain unresolved TODO/FIXME before release', ['todo', 'fixme'], ['architecture', 'unfinished-work']));
      }
    }
    return rules;
  }

  private inferred(repo: string, rel: string, expected: string, observedPatterns: string[], tags: string[]): ArchitectureRule {
    return {
      id: hashId(`inferred:${repo}:${rel}:${expected}`),
      repo,
      expected,
      observedPatterns,
      severity: observedPatterns.includes('duplicate execution') ? 'HIGH' : 'MEDIUM',
      description: `Inferred from ${rel}: ${expected}.`,
      tags,
      sourceType: 'INFERRED_DOCS',
      source: { provider: 'local', sourceId: rel, label: `Inferred docs rule: ${rel}` },
      updatedAt: new Date().toISOString(),
    };
  }

  private defaultRules(repo: string): ArchitectureRule[] {
    const now = new Date().toISOString();
    return [
      {
        id: `default-${repo}-rollback-protection`,
        repo,
        expected: 'rollback-linked safeguards require explicit review before removal',
        observedPatterns: ['remove guard', 'disable guard', 'delete debounce', 'remove retry cap'],
        severity: 'HIGH',
        description: 'AXIOM default rule: protect safeguards created after incidents and rollbacks.',
        tags: ['rollback', 'guard', 'protected-knowledge'],
        sourceType: 'AXIOM_DEFAULT',
        source: { provider: 'architecture-rule-provider', sourceId: `default-${repo}-rollback-protection`, label: 'AXIOM default rule: rollback protection' },
        updatedAt: now,
      },
    ];
  }

  private resolvePrecedence(rules: ArchitectureRule[]): ArchitectureRule[] {
    const priority = { REMOTE_CANONICAL: 4, LOCAL_OVERRIDE: 3, INFERRED_DOCS: 2, AXIOM_DEFAULT: 1 };
    const byKey = new Map<string, ArchitectureRule>();
    for (const rule of rules) {
      const key = `${rule.repo ?? '*'}:${rule.scope ?? '*'}:${rule.expected.toLowerCase()}`;
      const existing = byKey.get(key);
      if (!existing || priority[rule.sourceType] > priority[existing.sourceType]) {
        byKey.set(key, rule);
      }
    }
    return [...byKey.values()].sort((a, b) => priority[b.sourceType] - priority[a.sourceType] || b.updatedAt.localeCompare(a.updatedAt));
  }
}
