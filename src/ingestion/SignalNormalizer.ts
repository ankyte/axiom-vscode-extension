import { EngineeringSignal, NormalizedSignal } from '../models/signals';
import { tokenize } from '../utils';

export class SignalNormalizer {
  public normalize(signal: EngineeringSignal): NormalizedSignal {
    const text = `${signal.title} ${signal.body} ${JSON.stringify(signal.metadata)}`;
    const keywords = [...new Set(tokenize(text))];
    const riskTags = this.riskTags(text);

    return {
      ...signal,
      keywords,
      riskTags,
      entities: {
        repositories: this.extractRepos(text, signal.repo),
        files: [...new Set([...(signal.file ? [signal.file] : []), ...this.extractFiles(text)])],
        incidents: this.extractIds(text, /(?:incident|oms|sev)[-\s#]*(\d+)/gi),
        pullRequests: this.extractIds(text, /(?:pr|pull request)[-\s#]*(\d+)/gi),
        commits: this.extractIds(text, /\b[0-9a-f]{6,12}\b/gi),
        workItems: this.extractIds(text, /(?:work item|bug|story|task)[-\s#]*(\d+)/gi),
        dependencies: this.extractDependencies(text),
      },
    };
  }

  private riskTags(text: string): string[] {
    const lower = text.toLowerCase();
    const tags: string[] = [];
    if (/rollback|revert/.test(lower)) tags.push('rollback');
    if (/incident|sev1|outage/.test(lower)) tags.push('incident');
    if (/retry|backoff|jitter/.test(lower)) tags.push('retry');
    if (/duplicate|double[-\s]?apply|idempot/.test(lower)) tags.push('duplicate-execution');
    if (/async|race|fanout/.test(lower)) tags.push('async-risk');
    if (/todo|fixme/.test(lower)) tags.push('unfinished-work');
    if (/hotfix/.test(lower)) tags.push('hotfix');
    if (/throttle|vendor/.test(lower)) tags.push('vendor-throttle');
    return [...new Set(tags)];
  }

  private extractIds(text: string, regex: RegExp): string[] {
    const ids: string[] = [];
    for (const match of text.matchAll(regex)) {
      ids.push(match[1] ?? match[0]);
    }
    return [...new Set(ids)];
  }

  private extractFiles(text: string): string[] {
    return [...new Set(text.match(/\b[\w./-]+\.(?:ts|tsx|js|jsx|md|json|yaml|yml|go|py|java|rs)\b/g) ?? [])];
  }

  private extractRepos(text: string, fallback: string): string[] {
    const known = ['pricing-service', 'settlement-engine', 'oms-gateway', 'backend-api', 'frontend-ui', 'order-router'];
    const found = known.filter((repo) => text.toLowerCase().includes(repo));
    return [...new Set([fallback, ...found])];
  }

  private extractDependencies(text: string): string[] {
    const known = ['oms-gateway', 'settlement-engine', 'pricing-service', 'vendor-rate-adapter', 'ledger-writer', 'backend-api'];
    return known.filter((dependency) => text.toLowerCase().includes(dependency));
  }
}
