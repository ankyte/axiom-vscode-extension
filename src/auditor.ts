import { AxiomMemory, RiskAuditFinding } from './types';

export class EngineeringAuditor {
  public run(memory: AxiomMemory): RiskAuditFinding[] {
    const findings: RiskAuditFinding[] = [];

    const text = `${memory.commits.map((c) => c.message).join(' ')} ${memory.files.map((f) => f.summary).join(' ')}`.toLowerCase();

    if (text.includes('remove retry') || text.includes('disable retry')) {
      findings.push({
        severity: 'high',
        statement: 'Retry logic appears removed despite resiliency-oriented history.',
        evidence: 'Commit history contains retry-removal language.',
      });
    }

    if (text.includes('disable guard') || text.includes('skip validation')) {
      findings.push({
        severity: 'high',
        statement: 'A safeguard may have been removed while risk controls remain expected.',
        evidence: 'Detected guard/validation removal keywords in commit messages or summaries.',
      });
    }

    const architectureText = memory.architecture.architectureSummary.toLowerCase();
    if (architectureText.includes('queue') && !text.includes('backpressure')) {
      findings.push({
        severity: 'medium',
        statement: 'Queue-based flow detected without explicit backpressure strategy.',
        evidence: 'Architecture references queues; no backpressure signal found in summaries.',
      });
    }

    return findings;
  }
}
