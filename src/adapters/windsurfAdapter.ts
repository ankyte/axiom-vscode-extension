import { AIContextAdapter, AIConversationChunk } from './types';

export class WindsurfAdapter implements AIContextAdapter {
  public readonly source = 'windsurf' as const;

  public async discoverSessions(): Promise<string[]> {
    return [];
  }

  public async extractChunks(_limit = 200, _workspaceRoot?: string): Promise<AIConversationChunk[]> {
    return [];
  }
}
