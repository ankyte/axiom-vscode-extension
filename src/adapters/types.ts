export interface AIConversationChunk {
  id: string;
  source: 'copilot' | 'windsurf' | 'markdown';
  sessionId: string;
  timestamp?: string;
  text: string;
  referencedFiles: string[];
  relatedServices: string[];
}

export interface AIContextAdapter {
  readonly source: 'copilot' | 'windsurf' | 'markdown';
  discoverSessions(): Promise<string[]>;
  extractChunks(limit?: number, workspaceRoot?: string): Promise<AIConversationChunk[]>;
}
