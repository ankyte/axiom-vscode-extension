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
exports.RepositoryIngestion = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const utils_1 = require("./utils");
const IMPORTANT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs', '.md', '.yml', '.yaml', '.json']);
class RepositoryIngestion {
    constructor(ai) {
        this.ai = ai;
    }
    async ingest(workspaceFolder) {
        const repoRoot = workspaceFolder.uri.fsPath;
        const files = await this.scanFiles(repoRoot);
        const commits = this.scanCommits(repoRoot);
        const prs = await this.loadMockPRs(repoRoot);
        const architecture = this.deriveArchitecture(files, commits, prs);
        return { architecture, files, commits, prs };
    }
    async scanFiles(repoRoot) {
        const discovered = await this.walk(repoRoot, repoRoot, 0);
        const insights = [];
        for (const relPath of discovered.slice(0, 120)) {
            const abs = path.join(repoRoot, relPath);
            const content = await fs.readFile(abs, 'utf8').catch(() => '');
            if (!content) {
                continue;
            }
            const lines = content.split(/\r?\n/).length;
            const language = path.extname(relPath).replace('.', '') || 'text';
            const preview = (0, utils_1.compactText)(content, 420);
            const summary = await this.ai.summarize(`File: ${relPath}\n${preview}`, `File ${relPath}`);
            const riskSignals = [];
            const lower = content.toLowerCase();
            if (lower.includes('retry')) {
                riskSignals.push('retry_logic_present');
            }
            if (lower.includes('todo') || lower.includes('fixme')) {
                riskSignals.push('unfinished_work');
            }
            if (lower.includes('queue')) {
                riskSignals.push('queue_dependency');
            }
            insights.push({ path: relPath, language, lines, summary, riskSignals });
        }
        return insights;
    }
    scanCommits(repoRoot) {
        try {
            const out = (0, child_process_1.execSync)('git log --pretty=format:"%h|%an|%ad|%s" -n 30 --date=short', {
                cwd: repoRoot,
                stdio: ['ignore', 'pipe', 'ignore'],
                encoding: 'utf8',
            });
            return out
                .split(/\r?\n/)
                .filter(Boolean)
                .map((line) => {
                const [hash, author, date, ...rest] = line.split('|');
                const message = rest.join('|').trim();
                const lower = message.toLowerCase();
                const riskSignals = [];
                if (lower.includes('hotfix') || lower.includes('rollback')) {
                    riskSignals.push('stability_incident');
                }
                if (lower.includes('remove') && (lower.includes('retry') || lower.includes('guard'))) {
                    riskSignals.push('safeguard_removed');
                }
                return {
                    hash,
                    author,
                    date,
                    message,
                    summary: (0, utils_1.compactText)(message, 140),
                    riskSignals,
                };
            });
        }
        catch {
            return [];
        }
    }
    async loadMockPRs(repoRoot) {
        const localMock = path.join(repoRoot, '.axiom', 'pr-summaries.json');
        const bundledMock = path.join(__dirname, 'mock-data', 'pr-summaries.json');
        for (const file of [localMock, bundledMock]) {
            try {
                const raw = await fs.readFile(file, 'utf8');
                return JSON.parse(raw);
            }
            catch {
                continue;
            }
        }
        return [];
    }
    deriveArchitecture(files, commits, prs) {
        const services = files
            .map((f) => f.path)
            .filter((p) => /service|module|controller|handler/i.test(p))
            .slice(0, 12);
        const entrypoints = files
            .map((f) => f.path)
            .filter((p) => /index\.|main\.|app\.|server\./i.test(p))
            .slice(0, 8);
        const dependencySignals = new Set();
        for (const f of files) {
            if (f.summary.includes('queue'))
                dependencySignals.add('queue');
            if (f.summary.includes('retry'))
                dependencySignals.add('retry-middleware');
            if (f.summary.includes('cache'))
                dependencySignals.add('cache-layer');
            if (f.summary.includes('auth'))
                dependencySignals.add('auth-provider');
        }
        const architectureSummary = (0, utils_1.compactText)(`System organized around ${Math.max(services.length, 1)} service-oriented modules. ` +
            `Entrypoints include ${entrypoints.slice(0, 3).join(', ') || 'no obvious runtime roots detected'}. ` +
            `Operational history suggests decisions around resiliency (${prs.map((p) => p.decision).slice(0, 2).join('; ') || 'limited PR memory'}). ` +
            `Recent changes: ${commits.slice(0, 2).map((c) => c.message).join(' | ') || 'no git history found'}.`, 380);
        return {
            services,
            entrypoints,
            dependencies: [...dependencySignals],
            architectureSummary,
        };
    }
    async walk(repoRoot, current, depth) {
        if (depth > 5) {
            return [];
        }
        const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
        const files = [];
        for (const entry of entries) {
            if (entry.name.startsWith('.git') ||
                entry.name === 'node_modules' ||
                entry.name === 'out' ||
                entry.name === 'dist' ||
                entry.name === '.axiom') {
                continue;
            }
            const full = path.join(current, entry.name);
            const rel = path.relative(repoRoot, full);
            if (entry.isDirectory()) {
                files.push(...(await this.walk(repoRoot, full, depth + 1)));
            }
            else {
                const ext = path.extname(entry.name);
                if (IMPORTANT_EXTENSIONS.has(ext) || entry.name === 'Dockerfile') {
                    files.push(rel);
                }
            }
        }
        return files;
    }
}
exports.RepositoryIngestion = RepositoryIngestion;
//# sourceMappingURL=ingestion.js.map