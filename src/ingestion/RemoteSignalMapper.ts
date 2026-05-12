import { IAzureDevOpsProvider } from '../providers/IAzureDevOpsProvider';
import { EngineeringSignal } from '../models/signals';

export class RemoteSignalMapper {
  constructor(private readonly azure: IAzureDevOpsProvider) {}

  public async fromRepository(repo: string): Promise<EngineeringSignal[]> {
    const [prs, commits, workItems] = await Promise.all([
      this.azure.getPullRequests(repo),
      this.azure.getRecentCommits(repo, 20),
      this.azure.getWorkItems(repo),
    ]);
    const details = await Promise.all(prs.map((pr) => this.azure.getPullRequestDetails(repo, pr.id)));
    const signals: EngineeringSignal[] = [];

    for (const pr of details.filter((item): item is NonNullable<typeof item> => item !== null)) {
      signals.push({
        id: `ado-pr-${pr.id}-${pr.status}`,
        type: pr.status === 'completed' ? 'PR_MERGED' : 'PR_CREATED',
        repo: pr.repo,
        branch: pr.sourceBranch,
        timestamp: pr.mergedAt ?? pr.createdAt,
        title: `PR #${pr.id}: ${pr.title}`,
        body: `${pr.description}\n${pr.comments.join('\n')}`,
        source: { provider: 'azure-devops', sourceId: pr.id, label: `PR #${pr.id}` },
        metadata: {
          status: pr.status,
          targetBranch: pr.targetBranch,
          workItemIds: pr.workItemIds,
          commitIds: pr.commitIds,
          tags: pr.tags,
          changedFiles: pr.changedFiles,
        },
      });
      if (pr.rollbackOf || pr.tags.includes('rollback')) {
        signals.push({
          id: `ado-rollback-${pr.id}`,
          type: 'ROLLBACK_DETECTED',
          repo: pr.repo,
          branch: pr.sourceBranch,
          timestamp: pr.mergedAt ?? pr.createdAt,
          title: `Rollback detected in PR #${pr.id}`,
          body: `${pr.title}. ${pr.description}. Rollback of ${pr.rollbackOf ?? 'unknown PR'}.`,
          source: { provider: 'azure-devops', sourceId: pr.id, label: `PR #${pr.id}` },
          metadata: { rollbackOf: pr.rollbackOf ?? '', tags: pr.tags },
        });
      }
      for (const comment of pr.comments) {
        signals.push({
          id: `ado-pr-comment-${pr.id}-${comment.length}`,
          type: 'PR_COMMENT',
          repo: pr.repo,
          branch: pr.sourceBranch,
          timestamp: pr.mergedAt ?? pr.createdAt,
          title: `PR #${pr.id} review comment`,
          body: comment,
          source: { provider: 'azure-devops', sourceId: pr.id, label: `PR #${pr.id} comment` },
          metadata: { prId: pr.id },
        });
      }
    }

    for (const commit of commits) {
      signals.push({
        id: `ado-commit-${commit.id}`,
        type: 'LOCAL_COMMIT',
        repo: commit.repo,
        branch: commit.branch,
        timestamp: commit.timestamp,
        title: commit.message,
        body: `${commit.message}. Files: ${commit.files.join(', ')}`,
        file: commit.files[0],
        source: { provider: 'azure-devops', sourceId: commit.id, label: `Commit ${commit.id}` },
        metadata: { files: commit.files, author: commit.author },
      });
    }

    for (const workItem of workItems) {
      signals.push({
        id: `ado-work-item-${workItem.id}`,
        type: workItem.type === 'Incident' ? 'INCIDENT_LINKED' : 'PR_COMMENT',
        repo: workItem.repo,
        timestamp: workItem.createdAt,
        title: `${workItem.type} #${workItem.id}: ${workItem.title}`,
        body: workItem.description,
        source: { provider: 'azure-devops', sourceId: workItem.id, label: `${workItem.type} #${workItem.id}` },
        metadata: { state: workItem.state, severity: workItem.severity ?? '', tags: workItem.tags },
      });
    }

    return signals;
  }
}
