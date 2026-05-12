import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { EngineeringSignal } from '../models/signals';
import { hashId } from '../utils';

export class LocalSignalCollector {
  public async collect(workspaceRoot: string, repo: string): Promise<EngineeringSignal[]> {
    const signals: EngineeringSignal[] = [];
    const latestCommit = this.latestCommit(workspaceRoot, repo);
    if (latestCommit) signals.push(latestCommit);
    signals.push(...(await this.scanTodoAndDependencySignals(workspaceRoot, repo)));
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

  private latestCommit(workspaceRoot: string, repo: string): EngineeringSignal | null {
    try {
      const out = execSync('git log --pretty=format:"%h|%D|%s" -n 1', {
        cwd: workspaceRoot,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8',
      });
      const [hash, refs, message] = out.split('|');
      return this.localCommit(repo, message || 'local commit', hash || 'local', refs || 'local');
    } catch {
      return null;
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
}
