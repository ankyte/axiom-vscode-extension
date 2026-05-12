import {
  AzureBranch,
  AzureCommit,
  AzurePullRequest,
  AzurePullRequestDetails,
  AzureRepository,
  AzureWorkItem,
  RepositoryConnection,
} from '../models/signals';

export interface IAzureDevOpsProvider {
  getPullRequests(repo?: string): Promise<AzurePullRequest[]>;
  getPullRequestDetails(repo: string, pullRequestId: string): Promise<AzurePullRequestDetails | null>;
  getRecentCommits(repo?: string, limit?: number): Promise<AzureCommit[]>;
  getRepositories(): Promise<AzureRepository[]>;
  getBranches(repo?: string): Promise<AzureBranch[]>;
  getWorkItems(repo?: string): Promise<AzureWorkItem[]>;
  getRepositoryConnections(repo?: string): Promise<RepositoryConnection[]>;
}
