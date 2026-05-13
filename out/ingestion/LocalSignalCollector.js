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
exports.LocalSignalCollector = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const utils_1 = require("../utils");
class LocalSignalCollector {
    constructor(storageRoot) {
        this.storageRoot = storageRoot;
    }
    async collect(workspaceRoot, repo) {
        const signals = [];
        signals.push(...(await this.gitSignals(workspaceRoot, repo)));
        signals.push(...(await this.scanTodoAndDependencySignals(workspaceRoot, repo)));
        signals.push(...(await this.scanLogSignals(workspaceRoot, repo)));
        return signals;
    }
    fileOpened(repo, file) {
        return {
            id: (0, utils_1.hashId)(`file-opened:${repo}:${file}:${Date.now()}`),
            type: 'FILE_OPENED',
            repo,
            timestamp: new Date().toISOString(),
            title: `File opened: ${file}`,
            body: `Developer opened ${file}; retrieve organizational memory scoped to this file and repository.`,
            file,
            source: { provider: 'local', sourceId: file, label: `File ${file}` },
            metadata: { file },
        };
    }
    async fileChanged(workspaceRoot, repo, file) {
        const abs = path.join(workspaceRoot, file);
        const content = await fs.readFile(abs, 'utf8').catch(() => '');
        if (!content)
            return [];
        const lower = content.toLowerCase();
        const type = /package-lock\.json|package\.json|pnpm-lock|yarn\.lock/.test(file) ? 'DEPENDENCY_CHANGE' : /architecture|readme|adr|docs\//i.test(file) ? 'ARCHITECTURE_FILE_CHANGED' : /todo|fixme/.test(lower) ? 'TODO_DETECTED' : 'FILE_OPENED';
        return [
            {
                id: (0, utils_1.hashId)(`file-change:${repo}:${file}:${content.length}:${this.stableTimeBucket()}`),
                type,
                repo,
                file,
                timestamp: new Date().toISOString(),
                title: `Local file changed: ${file}`,
                body: content.slice(0, 1600),
                source: { provider: 'local', sourceId: file, label: `File watcher: ${file}` },
                metadata: { file, bytes: content.length },
            },
        ];
    }
    localCommit(repo, message, commitId, branch = 'local') {
        return {
            id: (0, utils_1.hashId)(`local-commit:${repo}:${commitId}:${message}`),
            type: 'LOCAL_COMMIT',
            repo,
            branch,
            timestamp: new Date().toISOString(),
            title: message,
            body: `Local commit ${commitId}: ${message}`,
            source: { provider: 'local', sourceId: commitId, label: `Commit ${commitId}` },
            metadata: { commitId, branch },
        };
    }
    async gitSignals(workspaceRoot, repo) {
        const state = await this.readCursorState();
        const cursor = state.repos[repo];
        const branch = this.currentBranch(workspaceRoot);
        const commits = this.recentCommits(workspaceRoot, repo, cursor?.lastCommit);
        const signals = [];
        if (branch && branch !== cursor?.branch) {
            signals.push({
                id: (0, utils_1.hashId)(`branch:${repo}:${branch}`),
                type: 'BRANCH_CREATED',
                repo,
                branch,
                timestamp: new Date().toISOString(),
                title: `Active branch changed: ${branch}`,
                body: `Developer is working on branch ${branch}. AXIOM should scope provisional memory to this branch until merge.`,
                source: { provider: 'local', sourceId: branch, label: `Branch ${branch}` },
                metadata: { branch },
            });
        }
        signals.push(...commits);
        const newest = commits[0]?.source.sourceId ?? cursor?.lastCommit;
        state.repos[repo] = { lastCommit: newest, branch: branch ?? cursor?.branch, lastScanAt: new Date().toISOString() };
        await this.writeCursorState(state);
        return signals;
    }
    currentBranch(workspaceRoot) {
        try {
            return (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD', {
                cwd: workspaceRoot,
                stdio: ['ignore', 'pipe', 'ignore'],
                encoding: 'utf8',
            }).trim();
        }
        catch {
            return null;
        }
    }
    recentCommits(workspaceRoot, repo, lastSeen) {
        try {
            const out = (0, child_process_1.execSync)('git log --pretty=format:"%h|%D|%ad|%an|%s" -n 40 --date=iso-strict', {
                cwd: workspaceRoot,
                stdio: ['ignore', 'pipe', 'ignore'],
                encoding: 'utf8',
            });
            const commits = [];
            for (const line of out.split(/\r?\n/).filter(Boolean)) {
                const [hash, refs, timestamp, author, ...rest] = line.split('|');
                if (lastSeen && hash === lastSeen)
                    break;
                const message = rest.join('|').trim();
                commits.push({
                    ...this.localCommit(repo, message || 'local commit', hash || 'local', refs || 'local'),
                    timestamp: timestamp || new Date().toISOString(),
                    actor: author,
                    metadata: { commitId: hash, branch: refs, author },
                });
            }
            return commits;
        }
        catch {
            return [];
        }
    }
    async scanTodoAndDependencySignals(workspaceRoot, repo) {
        const candidates = ['package.json', 'docs/architecture.md', 'README.md'];
        const signals = [];
        for (const rel of candidates) {
            const abs = path.join(workspaceRoot, rel);
            const content = await fs.readFile(abs, 'utf8').catch(() => '');
            if (!content)
                continue;
            const lower = content.toLowerCase();
            if (lower.includes('todo') || lower.includes('fixme')) {
                signals.push({
                    id: (0, utils_1.hashId)(`todo:${repo}:${rel}:${content.length}`),
                    type: 'TODO_DETECTED',
                    repo,
                    file: rel,
                    timestamp: new Date().toISOString(),
                    title: `TODO/FIXME detected in ${rel}`,
                    body: content.slice(0, 1200),
                    source: { provider: 'local', sourceId: rel, label: `Local scan ${rel}` },
                    metadata: { file: rel },
                });
            }
            if (rel === 'package.json') {
                signals.push({
                    id: (0, utils_1.hashId)(`dependencies:${repo}:${content.length}`),
                    type: 'DEPENDENCY_CHANGE',
                    repo,
                    file: rel,
                    timestamp: new Date().toISOString(),
                    title: `Dependency manifest indexed for ${repo}`,
                    body: content.slice(0, 1200),
                    source: { provider: 'local', sourceId: rel, label: 'package.json' },
                    metadata: { file: rel },
                });
            }
            if (/architecture|retry|backoff|service/.test(lower)) {
                signals.push({
                    id: (0, utils_1.hashId)(`architecture:${repo}:${rel}:${content.length}`),
                    type: 'ARCHITECTURE_FILE_CHANGED',
                    repo,
                    file: rel,
                    timestamp: new Date().toISOString(),
                    title: `Architecture signal from ${rel}`,
                    body: content.slice(0, 1200),
                    source: { provider: 'local', sourceId: rel, label: `Architecture ${rel}` },
                    metadata: { file: rel },
                });
            }
        }
        return signals;
    }
    async scanLogSignals(workspaceRoot, repo) {
        const files = await this.walkLogs(workspaceRoot, ['logs', '.axiom/logs', '.history']);
        const signals = [];
        for (const rel of files.slice(0, 20)) {
            const content = await fs.readFile(path.join(workspaceRoot, rel), 'utf8').catch(() => '');
            if (!/error|exception|incident|outage|rollback|retry|throttle|duplicate/i.test(content))
                continue;
            signals.push({
                id: (0, utils_1.hashId)(`log:${repo}:${rel}:${content.length}`),
                type: /incident|outage|sev|exception|error/i.test(content) ? 'INCIDENT_LINKED' : 'PR_COMMENT',
                repo,
                file: rel,
                timestamp: new Date().toISOString(),
                title: `Local operational log signal: ${rel}`,
                body: content.slice(0, 1600),
                source: { provider: 'local', sourceId: rel, label: `Local log: ${rel}` },
                metadata: { file: rel },
            });
        }
        return signals;
    }
    async walkLogs(workspaceRoot, roots) {
        const files = [];
        for (const root of roots) {
            files.push(...(await this.walkLogDir(workspaceRoot, path.join(workspaceRoot, root), 0)));
        }
        return files;
    }
    async walkLogDir(workspaceRoot, dir, depth) {
        if (depth > 3)
            return [];
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
        const files = [];
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...(await this.walkLogDir(workspaceRoot, full, depth + 1)));
            }
            else if (/\.(log|txt|json|jsonl|md)$/i.test(entry.name)) {
                files.push(path.relative(workspaceRoot, full));
            }
        }
        return files;
    }
    stableTimeBucket() {
        return String(Math.floor(Date.now() / 5000));
    }
    async readCursorState() {
        if (!this.storageRoot)
            return { repos: {} };
        const file = this.cursorPath();
        try {
            const raw = await fs.readFile(file, 'utf8');
            return JSON.parse(raw);
        }
        catch {
            return { repos: {} };
        }
    }
    async writeCursorState(state) {
        if (!this.storageRoot)
            return;
        await fs.mkdir(this.storageRoot, { recursive: true });
        await fs.writeFile(this.cursorPath(), JSON.stringify(state, null, 2), 'utf8');
    }
    cursorPath() {
        return path.join(this.storageRoot ?? '.', 'axiom-local-cursors.json');
    }
}
exports.LocalSignalCollector = LocalSignalCollector;
//# sourceMappingURL=LocalSignalCollector.js.map