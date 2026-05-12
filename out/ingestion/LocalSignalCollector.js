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
    async collect(workspaceRoot, repo) {
        const signals = [];
        const latestCommit = this.latestCommit(workspaceRoot, repo);
        if (latestCommit)
            signals.push(latestCommit);
        signals.push(...(await this.scanTodoAndDependencySignals(workspaceRoot, repo)));
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
    latestCommit(workspaceRoot, repo) {
        try {
            const out = (0, child_process_1.execSync)('git log --pretty=format:"%h|%D|%s" -n 1', {
                cwd: workspaceRoot,
                stdio: ['ignore', 'pipe', 'ignore'],
                encoding: 'utf8',
            });
            const [hash, refs, message] = out.split('|');
            return this.localCommit(repo, message || 'local commit', hash || 'local', refs || 'local');
        }
        catch {
            return null;
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
}
exports.LocalSignalCollector = LocalSignalCollector;
//# sourceMappingURL=LocalSignalCollector.js.map