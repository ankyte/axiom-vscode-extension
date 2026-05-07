import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import * as vscode from 'vscode';
import { OpenAIClient } from './openaiClient';
import { ArchitectureSnapshot, CommitInsight, FileInsight, PRInsight } from './types';
import { compactText } from './utils';

const IMPORTANT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs', '.md', '.yml', '.yaml', '.json']);

export class RepositoryIngestion {
  constructor(private readonly ai: OpenAIClient) {}

  public async ingest(workspaceFolder: vscode.WorkspaceFolder): Promise<{
    architecture: ArchitectureSnapshot;
    files: FileInsight[];
    commits: CommitInsight[];
    prs: PRInsight[];
  }> {
    const repoRoot = workspaceFolder.uri.fsPath;
    const files = await this.scanFiles(repoRoot);
    const commits = this.scanCommits(repoRoot);
    const prs = await this.loadMockPRs(repoRoot);
    const architecture = this.deriveArchitecture(files, commits, prs);

    return { architecture, files, commits, prs };
  }

  private async scanFiles(repoRoot: string): Promise<FileInsight[]> {
    const discovered = await this.walk(repoRoot, repoRoot, 0);
    const insights: FileInsight[] = [];

    for (const relPath of discovered.slice(0, 120)) {
      const abs = path.join(repoRoot, relPath);
      const content = await fs.readFile(abs, 'utf8').catch(() => '');
      if (!content) {
        continue;
      }
      const lines = content.split(/\r?\n/).length;
      const language = path.extname(relPath).replace('.', '') || 'text';
      const preview = compactText(content, 420);
      const summary = await this.ai.summarize(`File: ${relPath}\n${preview}`, `File ${relPath}`);

      const riskSignals: string[] = [];
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

  private scanCommits(repoRoot: string): CommitInsight[] {
    try {
      const out = execSync('git log --pretty=format:"%h|%an|%ad|%s" -n 30 --date=short', {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8',
      });

      return out
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line: string) => {
          const [hash, author, date, ...rest] = line.split('|');
          const message = rest.join('|').trim();
          const lower = message.toLowerCase();
          const riskSignals: string[] = [];
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
            summary: compactText(message, 140),
            riskSignals,
          };
        });
    } catch {
      return [];
    }
  }

  private async loadMockPRs(repoRoot: string): Promise<PRInsight[]> {
    const localMock = path.join(repoRoot, '.axiom', 'pr-summaries.json');
    const bundledMock = path.join(__dirname, 'mock-data', 'pr-summaries.json');
    for (const file of [localMock, bundledMock]) {
      try {
        const raw = await fs.readFile(file, 'utf8');
        return JSON.parse(raw) as PRInsight[];
      } catch {
        continue;
      }
    }
    return [];
  }

  private deriveArchitecture(files: FileInsight[], commits: CommitInsight[], prs: PRInsight[]): ArchitectureSnapshot {
    const services = files
      .map((f) => f.path)
      .filter((p) => /service|module|controller|handler/i.test(p))
      .slice(0, 12);

    const entrypoints = files
      .map((f) => f.path)
      .filter((p) => /index\.|main\.|app\.|server\./i.test(p))
      .slice(0, 8);

    const dependencySignals = new Set<string>();
    for (const f of files) {
      if (f.summary.includes('queue')) dependencySignals.add('queue');
      if (f.summary.includes('retry')) dependencySignals.add('retry-middleware');
      if (f.summary.includes('cache')) dependencySignals.add('cache-layer');
      if (f.summary.includes('auth')) dependencySignals.add('auth-provider');
    }

    const architectureSummary = compactText(
      `System organized around ${Math.max(services.length, 1)} service-oriented modules. ` +
        `Entrypoints include ${entrypoints.slice(0, 3).join(', ') || 'no obvious runtime roots detected'}. ` +
        `Operational history suggests decisions around resiliency (${prs.map((p) => p.decision).slice(0, 2).join('; ') || 'limited PR memory'}). ` +
        `Recent changes: ${commits.slice(0, 2).map((c) => c.message).join(' | ') || 'no git history found'}.`,
      380,
    );

    return {
      services,
      entrypoints,
      dependencies: [...dependencySignals],
      architectureSummary,
    };
  }

  private async walk(repoRoot: string, current: string, depth: number): Promise<string[]> {
    if (depth > 5) {
      return [];
    }

    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.git') || entry.name === 'node_modules' || entry.name === 'out' || entry.name === 'dist') {
        continue;
      }
      const full = path.join(current, entry.name);
      const rel = path.relative(repoRoot, full);
      if (entry.isDirectory()) {
        files.push(...(await this.walk(repoRoot, full, depth + 1)));
      } else {
        const ext = path.extname(entry.name);
        if (IMPORTANT_EXTENSIONS.has(ext) || entry.name === 'Dockerfile') {
          files.push(rel);
        }
      }
    }

    return files;
  }
}
