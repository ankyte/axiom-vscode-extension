import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { EngineeringSignal } from '../models/signals';
import { hashId } from '../utils';

interface LocalCursorState {
  repos: Record<string, { lastCommit?: string; branch?: string; lastScanAt?: string }>;
}

export class LocalSignalCollector {
  constructor(private readonly storageRoot?: string) {}

  public async collect(workspaceRoot: string, repo: string): Promise<EngineeringSignal[]> {
    const signals: EngineeringSignal[] = [];
    signals.push(...(await this.gitSignals(workspaceRoot, repo)));
    signals.push(...(await this.scanTodoAndDependencySignals(workspaceRoot, repo)));
    signals.push(...(await this.scanLogSignals(workspaceRoot, repo)));
    return signals;
  }

  public fileOpened(repo: string, file: string): EngineeringSignal {
    return {
      id: hashId(`file-opened:${repo}:${file}:${Date.now()}`),
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

  public async fileChanged(workspaceRoot: string, repo: string, file: string): Promise<EngineeringSignal[]> {
    const abs = path.join(workspaceRoot, file);
    const content = await fs.readFile(abs, 'utf8').catch(() => '');
    if (!content) return [];
    const lower = content.toLowerCase();
    const type =
      /package-lock\.json|package\.json|pnpm-lock|yarn\.lock/.test(file) ? 'DEPENDENCY_CHANGE' : /architecture|readme|adr|docs\//i.test(file) ? 'ARCHITECTURE_FILE_CHANGED' : /todo|fixme/.test(lower) ? 'TODO_DETECTED' : 'FILE_OPENED';
    return [
      {
        id: hashId(`file-change:${repo}:${file}:${content.length}:${this.stableTimeBucket()}`),
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

  public localCommit(repo: string, message: string, commitId: string, branch = 'local'): EngineeringSignal {
    return {
      id: hashId(`local-commit:${repo}:${commitId}:${message}`),
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

  private async gitSignals(workspaceRoot: string, repo: string): Promise<EngineeringSignal[]> {
    const state = await this.readCursorState();
    const cursor = state.repos[repo];
    const branch = this.currentBranch(workspaceRoot);
    const commits = this.recentCommits(workspaceRoot, repo, cursor?.lastCommit);
    const signals: EngineeringSignal[] = [];
    if (branch && branch !== cursor?.branch) {
      signals.push({
        id: hashId(`branch:${repo}:${branch}`),
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

  private currentBranch(workspaceRoot: string): string | null {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: workspaceRoot,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8',
      }).trim();
    } catch {
      return null;
    }
  }

  private recentCommits(workspaceRoot: string, repo: string, lastSeen?: string): EngineeringSignal[] {
    try {
      const out = execSync('git log --pretty=format:"%h|%D|%ad|%an|%s" -n 40 --date=iso-strict', {
        cwd: workspaceRoot,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8',
      });
      const commits: EngineeringSignal[] = [];
      for (const line of out.split(/\r?\n/).filter(Boolean)) {
        const [hash, refs, timestamp, author, ...rest] = line.split('|');
        if (lastSeen && hash === lastSeen) break;
        const message = rest.join('|').trim();
        commits.push({
          ...this.localCommit(repo, message || 'local commit', hash || 'local', refs || 'local'),
          timestamp: timestamp || new Date().toISOString(),
          actor: author,
          metadata: { commitId: hash, branch: refs, author },
        });
      }
      return commits;
    } catch {
      return [];
    }
  }

  private async scanTodoAndDependencySignals(workspaceRoot: string, repo: string): Promise<EngineeringSignal[]> {
    const candidates = ['package.json', 'docs/architecture.md', 'README.md'];
    const signals: EngineeringSignal[] = [];
    for (const rel of candidates) {
      const abs = path.join(workspaceRoot, rel);
      const content = await fs.readFile(abs, 'utf8').catch(() => '');
      if (!content) continue;
      const lower = content.toLowerCase();
      if (lower.includes('todo') || lower.includes('fixme')) {
        signals.push({
          id: hashId(`todo:${repo}:${rel}:${content.length}`),
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
          id: hashId(`dependencies:${repo}:${content.length}`),
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
          id: hashId(`architecture:${repo}:${rel}:${content.length}`),
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

  private async scanLogSignals(workspaceRoot: string, repo: string): Promise<EngineeringSignal[]> {
    const files = await this.walkLogs(workspaceRoot, ['logs', '.axiom/logs', '.history']);
    const signals: EngineeringSignal[] = [];
    for (const rel of files.slice(0, 20)) {
      const content = await fs.readFile(path.join(workspaceRoot, rel), 'utf8').catch(() => '');
      if (!/error|exception|incident|outage|rollback|retry|throttle|duplicate/i.test(content)) continue;
      signals.push({
        id: hashId(`log:${repo}:${rel}:${content.length}`),
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

  private async walkLogs(workspaceRoot: string, roots: string[]): Promise<string[]> {
    const files: string[] = [];
    for (const root of roots) {
      files.push(...(await this.walkLogDir(workspaceRoot, path.join(workspaceRoot, root), 0)));
    }
    return files;
  }

  private async walkLogDir(workspaceRoot: string, dir: string, depth: number): Promise<string[]> {
    if (depth > 3) return [];
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    const files: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.walkLogDir(workspaceRoot, full, depth + 1)));
      } else if (/\.(log|txt|json|jsonl|md)$/i.test(entry.name)) {
        files.push(path.relative(workspaceRoot, full));
      }
    }
    return files;
  }

  private stableTimeBucket(): string {
    return String(Math.floor(Date.now() / 5000));
  }

  private async readCursorState(): Promise<LocalCursorState> {
    if (!this.storageRoot) return { repos: {} };
    const file = this.cursorPath();
    try {
      const raw = await fs.readFile(file, 'utf8');
      return JSON.parse(raw) as LocalCursorState;
    } catch {
      return { repos: {} };
    }
  }

  private async writeCursorState(state: LocalCursorState): Promise<void> {
    if (!this.storageRoot) return;
    await fs.mkdir(this.storageRoot, { recursive: true });
    await fs.writeFile(this.cursorPath(), JSON.stringify(state, null, 2), 'utf8');
  }

  private cursorPath(): string {
    return path.join(this.storageRoot ?? '.', 'axiom-local-cursors.json');
  }
}
