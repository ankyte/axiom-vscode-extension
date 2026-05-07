import { CommitInsight, CompressedSummary, FileInsight, PRInsight } from './types';
import { hashId, toMockEmbedding } from './utils';

export class CavemanEngine {
  public compress(input: {
    files: FileInsight[];
    commits: CommitInsight[];
    prs: PRInsight[];
    architectureSummary: string;
  }): CompressedSummary[] {
    const result: CompressedSummary[] = [];

    for (const file of input.files.slice(0, 60)) {
      const intent = this.intentFromText(file.summary);
      const behavior = this.behaviorFromText(file.summary);
      const caveman = this.toCaveman(file.summary);
      result.push(this.makeSummary('file', file.path, caveman, intent, behavior, file.riskSignals, 'caveman'));
      result.push(this.makeSummary('file', file.path, file.summary, intent, behavior, file.riskSignals, 'developer'));
      result.push(
        this.makeSummary(
          'file',
          file.path,
          `This file contributes to system behavior by ${behavior}. Intent centers on ${intent}.`,
          intent,
          behavior,
          file.riskSignals,
          'system',
        ),
      );
    }

    for (const commit of input.commits.slice(0, 25)) {
      const intent = this.intentFromText(commit.message);
      const behavior = this.behaviorFromText(commit.message);
      result.push(this.makeSummary('commit', commit.hash, this.toCaveman(commit.message), intent, behavior, commit.riskSignals, 'caveman'));
      result.push(this.makeSummary('commit', commit.hash, commit.summary, intent, behavior, commit.riskSignals, 'developer'));
    }

    for (const pr of input.prs.slice(0, 12)) {
      const text = `${pr.title}. ${pr.summary}. Decision: ${pr.decision}. Risk: ${pr.risk}`;
      result.push(this.makeSummary('module', pr.id, this.toCaveman(text), pr.decision, pr.summary, [pr.risk], 'caveman'));
      result.push(this.makeSummary('module', pr.id, pr.summary, pr.decision, pr.summary, [pr.risk], 'developer'));
      result.push(this.makeSummary('module', pr.id, `System decision: ${pr.decision}. Operational risk: ${pr.risk}.`, pr.decision, pr.summary, [pr.risk], 'system'));
    }

    result.push(
      this.makeSummary(
        'repo',
        'repo-root',
        this.toCaveman(input.architectureSummary),
        'Preserve operational resilience and shared understanding.',
        input.architectureSummary,
        [],
        'caveman',
      ),
    );
    result.push(
      this.makeSummary('repo', 'repo-root', input.architectureSummary, 'Repository architecture intent.', input.architectureSummary, [], 'system'),
    );

    return result;
  }

  private makeSummary(
    sourceType: 'file' | 'commit' | 'module' | 'repo',
    sourceId: string,
    text: string,
    intent: string,
    behavior: string,
    risks: string[],
    level: 'caveman' | 'developer' | 'system',
  ): CompressedSummary {
    return {
      id: hashId(`${sourceType}:${sourceId}:${level}:${text}`),
      level,
      sourceType,
      sourceId,
      text,
      intent,
      behavior,
      risks,
      vector: toMockEmbedding(`${text} ${intent} ${behavior} ${risks.join(' ')}`),
    };
  }

  private intentFromText(text: string): string {
    const t = text.toLowerCase();
    if (t.includes('retry')) return 'increase resiliency against transient failures';
    if (t.includes('auth')) return 'enforce secure access and identity boundaries';
    if (t.includes('cache')) return 'reduce latency and repeated external calls';
    if (t.includes('queue')) return 'decouple synchronous pressure from downstream systems';
    return 'keep module behavior stable and understandable';
  }

  private behaviorFromText(text: string): string {
    const t = text.toLowerCase();
    if (t.includes('retry')) return 'retrying failures before escalation';
    if (t.includes('queue')) return 'routing overflow work to asynchronous processing';
    if (t.includes('validate')) return 'validating inputs before execution';
    return 'executing core service flow with moderate coupling';
  }

  private toCaveman(text: string): string {
    const lower = text.toLowerCase();
    const parts: string[] = [];
    if (lower.includes('payment')) parts.push('payment');
    if (lower.includes('auth')) parts.push('auth');
    if (lower.includes('retry')) parts.push('fail -> retry');
    if (lower.includes('queue')) parts.push('retry -> queue fallback');
    if (lower.includes('cache')) parts.push('cache -> fast path');
    if (lower.includes('latency')) parts.push('latency risk');
    if (parts.length === 0) parts.push('system change -> behavior shift');
    return parts.join(' | ');
  }
}
