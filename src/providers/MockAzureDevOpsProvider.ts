import { IAzureDevOpsProvider } from './IAzureDevOpsProvider';
import {
  AzureBranch,
  AzureCommit,
  AzurePullRequest,
  AzurePullRequestDetails,
  AzureRepository,
  AzureWorkItem,
  RepositoryConnection,
} from '../models/signals';
import {
  mockBranches,
  mockCommits,
  mockConnections,
  mockPullRequests,
  mockRepositories,
  mockWorkItems,
} from '../mock/enterpriseMockData';

export class MockAzureDevOpsProvider implements IAzureDevOpsProvider {
  private readonly repositories = [...mockRepositories];
  private readonly branches = [...mockBranches];
  private readonly commits = [...mockCommits];
  private readonly pullRequests = [...mockPullRequests];
  private readonly workItems = [...mockWorkItems];
  private readonly connections = [...mockConnections];

  public async getPullRequests(repo?: string): Promise<AzurePullRequest[]> {
    // TODO: REAL AZ CLI IMPLEMENTATION HERE
    return this.filterByRepo(this.pullRequests, repo).map(({ comments, changedFiles, linkedIncidentIds, rollbackOf, ...pr }) => pr);
  }

  public async getPullRequestDetails(repo: string, pullRequestId: string): Promise<AzurePullRequestDetails | null> {
    // TODO: REAL AZ CLI IMPLEMENTATION HERE
    return this.pullRequests.find((pr) => pr.repo === repo && pr.id === pullRequestId) ?? null;
  }

  public async getRecentCommits(repo?: string, limit = 25): Promise<AzureCommit[]> {
    // TODO: REAL AZ CLI IMPLEMENTATION HERE
    return this.filterByRepo(this.commits, repo).slice(0, limit);
  }

  public async getRepositories(): Promise<AzureRepository[]> {
    // TODO: REAL AZ CLI IMPLEMENTATION HERE
    return [...this.repositories];
  }

  public async getBranches(repo?: string): Promise<AzureBranch[]> {
    // TODO: REAL AZ CLI IMPLEMENTATION HERE
    return this.filterByRepo(this.branches, repo);
  }

  public async getWorkItems(repo?: string): Promise<AzureWorkItem[]> {
    // TODO: REAL AZ CLI IMPLEMENTATION HERE
    return this.filterByRepo(this.workItems, repo);
  }

  public async getRepositoryConnections(repo?: string): Promise<RepositoryConnection[]> {
    // TODO: REAL AZ CLI IMPLEMENTATION HERE
    if (!repo) return [...this.connections];
    return this.connections.filter((connection) => connection.fromRepo === repo || connection.toRepo === repo);
  }

  public simulateMergedPullRequest(repo: string): AzurePullRequestDetails | null {
    const pr = this.pullRequests.find((candidate) => candidate.repo === repo && candidate.status === 'active');
    if (!pr) return null;
    pr.status = 'completed';
    pr.mergedAt = new Date().toISOString();
    pr.tags = [...new Set([...pr.tags, 'canonicalized'])];
    return pr;
  }

  private filterByRepo<T extends { repo: string }>(items: T[], repo?: string): T[] {
    return repo ? items.filter((item) => item.repo === repo) : [...items];
  }
}
