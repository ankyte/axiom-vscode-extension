import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { AIContextAdapter, AIConversationChunk } from './types';
import { compactText, hashId } from '../utils';

const CODE_HINTS = [
  'architecture',
  'retry',
  'queue',
  'service',
  'module',
  'error',
  'incident',
  'latency',
  'timeout',
  'tradeoff',
  'design',
  'decision',
  'cache',
  'auth',
  'refactor',
  'risk',
  'deploy',
  'db',
  'database',
  'worker',
  'api',
  'middleware',
  'scal',
  'failure',
];

export class CopilotAdapter implements AIContextAdapter {
  public readonly source = 'copilot' as const;

  private workspaceStoragePaths(): string[] {
    const home = os.homedir();
    const appData = process.env.APPDATA;
    const candidates = [
      appData ? path.join(appData, 'Code', 'User', 'workspaceStorage') : '',
      path.join(home, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage'),
      path.join(home, '.config', 'Code', 'User', 'workspaceStorage'),
    ];
    return candidates.filter(Boolean);
  }

  public async discoverSessions(): Promise<string[]> {
    const roots = this.workspaceStoragePaths();
    const files: string[] = [];

    for (const root of roots) {
      const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
      for (const ws of entries) {
        if (!ws.isDirectory()) continue;
        const base = path.join(root, ws.name);
        const chatDir = path.join(base, 'chatSessions');
        const chatFiles = await this.collectSessionFiles(chatDir);
        files.push(...chatFiles);
      }
    }

    return files;
  }

  public async extractChunks(limit = 200, workspaceRoot?: string): Promise<AIConversationChunk[]> {
    const sessionFiles = await this.discoverSessions();
    const chunks: AIConversationChunk[] = [];

    for (const file of sessionFiles) {
      if (chunks.length >= limit) break;
      const sessionId = path.basename(file, path.extname(file));
      const raw = await fs.readFile(file, 'utf8').catch(() => '');
      if (!raw.trim()) continue;

      for (const textBlock of this.readMessageBlocks(raw)) {
        if (!this.isHighSignal(textBlock)) continue;
        if (!this.isRelevantToWorkspace(textBlock, workspaceRoot)) continue;
        const referencedFiles = this.extractFiles(textBlock);
        const relatedServices = this.extractServices(textBlock);
        chunks.push({
          id: hashId(`${file}:${textBlock}`),
          source: 'copilot',
          sessionId,
          text: compactText(textBlock, 420),
          referencedFiles,
          relatedServices,
        });

        if (chunks.length >= limit) break;
      }
    }

    return chunks;
  }

  private async collectSessionFiles(chatDir: string): Promise<string[]> {
    const entries = await fs.readdir(chatDir, { withFileTypes: true }).catch(() => []);
    const files: string[] = [];

    for (const entry of entries) {
      const full = path.join(chatDir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.collectSessionFiles(full)));
      } else if (/\.jsonl?$/.test(entry.name)) {
        files.push(full);
      }
    }

    return files;
  }

  private readMessageBlocks(raw: string): string[] {
    const blocks: string[] = [];

    const parsedJson = this.tryJson(raw);
    if (parsedJson) {
      this.collectTextFields(parsedJson, blocks);
      return blocks;
    }

    const lines = raw.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const parsed = this.tryJson(line);
      if (!parsed) continue;
      this.collectTextFields(parsed, blocks);
    }

    return blocks;
  }

  private collectTextFields(value: unknown, sink: string[]): void {
    if (typeof value === 'string') {
      const t = value.trim();
      if (t.length > 30) sink.push(t);
      return;
    }

    if (!value || typeof value !== 'object') return;

    if (Array.isArray(value)) {
      for (const v of value) this.collectTextFields(v, sink);
      return;
    }

    const obj = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && /(text|content|message|prompt|response|body|markdown)/i.test(k)) {
        const t = v.trim();
        if (t.length > 30) sink.push(t);
      } else {
        this.collectTextFields(v, sink);
      }
    }
  }

  private tryJson(raw: string): unknown | null {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private isHighSignal(text: string): boolean {
    const lower = text.toLowerCase();
    if (lower.includes('vscode.prompt.instructions')) return false;
    if (lower.includes('agents.md') && !lower.includes('architecture') && !lower.includes('service')) return false;
    if (/^[-A-Za-z0-9+/=_]{140,}$/.test(text.trim())) return false;
    const codeLike = /[\w-]+\.(ts|tsx|js|jsx|py|go|java|rs|json|yml|yaml|md)\b/.test(text);
    const hit = CODE_HINTS.some((h) => lower.includes(h));
    const ignore = /(hello|thanks|thank you|great|nice|awesome|how are you)/i.test(lower) && lower.length < 120;
    return (hit || codeLike) && !ignore;
  }

  private isRelevantToWorkspace(text: string, workspaceRoot?: string): boolean {
    if (!workspaceRoot) return true;
    const lower = text.toLowerCase();
    const rootLower = workspaceRoot.toLowerCase();
    const baseLower = path.basename(workspaceRoot).toLowerCase();

    if (lower.includes(rootLower) || lower.includes(baseLower)) {
      return true;
    }

    const refs = this.extractFiles(text);
    if (refs.some((r) => !r.startsWith('/') && !r.startsWith('file://'))) {
      return true;
    }

    return false;
  }

  private extractFiles(text: string): string[] {
    const matches = text.match(/[A-Za-z0-9_./-]+\.(ts|tsx|js|jsx|py|go|java|rs|json|yml|yaml|md)\b/g) ?? [];
    return [...new Set(matches)].slice(0, 8);
  }

  private extractServices(text: string): string[] {
    const services = text
      .split(/\s+/)
      .filter((token) => /(service|module|controller|worker|middleware|gateway)/i.test(token))
      .map((token) => token.replace(/[^a-z0-9_-]/gi, ''))
      .filter((token) => token.length > 2);
    return [...new Set(services)].slice(0, 8);
  }
}
