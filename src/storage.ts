import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { AxiomMemory } from './types';

export class MemoryStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  private getPath(repoRoot: string): string {
    const safe = repoRoot.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return path.join(this.context.globalStorageUri.fsPath, `${safe}.axiom.json`);
  }

  public async save(memory: AxiomMemory): Promise<void> {
    await fs.mkdir(this.context.globalStorageUri.fsPath, { recursive: true });
    await fs.writeFile(this.getPath(memory.repoRoot), JSON.stringify(memory, null, 2), 'utf8');
  }

  public async load(repoRoot: string): Promise<AxiomMemory | null> {
    try {
      const raw = await fs.readFile(this.getPath(repoRoot), 'utf8');
      return JSON.parse(raw) as AxiomMemory;
    } catch {
      return null;
    }
  }
}
