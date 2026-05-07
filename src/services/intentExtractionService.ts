import { AIConversationChunk } from '../adapters/types';
import { compactText, hashId } from '../utils';

export interface ExtractedIntent {
  id: string;
  source: 'copilot' | 'windsurf' | 'markdown';
  sessionId: string;
  timestamp: string;
  what: string;
  why: string;
  impact: string;
  referencedFiles: string[];
  relatedServices: string[];
  rawExcerpt: string;
}

export class IntentExtractionService {
  public extract(chunks: AIConversationChunk[]): ExtractedIntent[] {
    return chunks.filter((chunk) => this.shouldKeepChunk(chunk.text)).map((chunk) => {
      const sentences = chunk.text
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean);

      const what = compactText(this.pickWhat(sentences, chunk.text), 140);
      const why = compactText(this.pickWhy(sentences, chunk.text), 140);
      const impact = compactText(this.pickImpact(sentences, chunk.text), 160);

      return {
        id: hashId(`${chunk.id}:${what}:${why}:${impact}`),
        source: chunk.source,
        sessionId: chunk.sessionId,
        timestamp: chunk.timestamp ?? new Date().toISOString(),
        what,
        why,
        impact,
        referencedFiles: chunk.referencedFiles,
        relatedServices: chunk.relatedServices,
        rawExcerpt: compactText(chunk.text, 280),
      };
    });
  }

  private pickWhat(sentences: string[], fallback: string): string {
    const found = sentences.find((s) => /(add|remove|introduc|refactor|change|implement|migrate|fix|retry|queue|cache|auth)/i.test(s));
    return found ?? 'Operational behavior and implementation details were discussed.';
  }

  private pickWhy(sentences: string[], fallback: string): string {
    const found = sentences.find((s) => /(because|due to|since|to avoid|to reduce|for reliability|for resiliency|for performance)/i.test(s));
    if (found) return found;
    if (/timeout|latency|incident|failure|outage|error/i.test(fallback)) {
      return 'Reasoning references operational instability and reliability constraints.';
    }
    return 'Reasoning focused on maintainability and predictable behavior.';
  }

  private pickImpact(sentences: string[], fallback: string): string {
    const found = sentences.find((s) => /(impact|result|improve|risk|tradeoff|resilien|latency|stability|throughput|coupling)/i.test(s));
    if (found) return found;
    if (/retry|queue/i.test(fallback)) return 'Improves resiliency but may increase latency and queue pressure.';
    if (/cache/i.test(fallback)) return 'Improves response performance with potential staleness tradeoffs.';
    return 'Clarifies system behavior and expected operational outcomes.';
  }

  private shouldKeepChunk(text: string): boolean {
    const t = text.toLowerCase();
    if (t.startsWith('searched for regex')) return false;
    if (t.includes('data_sources.query') || t.includes('node_modules/@notionhq/client')) return false;
    if (t.includes('vscode.prompt.instructions')) return false;
    if (/^[-a-z0-9+/=_\s]{120,}$/i.test(t) && !/[.?!]/.test(t)) return false;
    const hasSignal = /(retry|queue|service|module|architecture|decision|risk|latency|timeout|cache|auth|middleware|deploy|incident|failure)/i.test(
      text,
    );
    return hasSignal;
  }
}
