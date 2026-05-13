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
exports.ArchitectureRuleProvider = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const utils_1 = require("../utils");
class ArchitectureRuleProvider {
    constructor(store, workspaceRoot) {
        this.store = store;
        this.workspaceRoot = workspaceRoot;
    }
    async getRules(repo) {
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
    async localOverrides(repo, workspaceRoot) {
        const file = path.join(workspaceRoot, '.axiom', 'architecture-rules.json');
        const raw = await fs.readFile(file, 'utf8').catch(() => '');
        if (!raw)
            return [];
        try {
            const parsed = JSON.parse(raw);
            return parsed.map((rule, index) => ({
                id: rule.id ?? (0, utils_1.hashId)(`local-rule:${repo}:${index}:${rule.expected}`),
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
        }
        catch {
            return [
                {
                    id: (0, utils_1.hashId)(`malformed-local-rule:${repo}`),
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
    async inferredFromDocs(repo, workspaceRoot) {
        const docs = await Promise.all(['docs/architecture.md', 'README.md'].map(async (rel) => ({ rel, content: await fs.readFile(path.join(workspaceRoot, rel), 'utf8').catch(() => '') })));
        const rules = [];
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
    inferred(repo, rel, expected, observedPatterns, tags) {
        return {
            id: (0, utils_1.hashId)(`inferred:${repo}:${rel}:${expected}`),
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
    defaultRules(repo) {
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
    resolvePrecedence(rules) {
        const priority = { REMOTE_CANONICAL: 4, LOCAL_OVERRIDE: 3, INFERRED_DOCS: 2, AXIOM_DEFAULT: 1 };
        const byKey = new Map();
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
exports.ArchitectureRuleProvider = ArchitectureRuleProvider;
//# sourceMappingURL=ArchitectureRuleProvider.js.map