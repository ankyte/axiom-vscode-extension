import { Provenance } from './memory';

export type EngineeringSignalType =
  | 'LOCAL_COMMIT'
  | 'BRANCH_CREATED'
  | 'FILE_OPENED'
  | 'ARCHITECTURE_FILE_CHANGED'
  | 'DEPENDENCY_CHANGE'
  | 'TODO_DETECTED'
  | 'PR_CREATED'
  | 'PR_MERGED'
  | 'PR_COMMENT'
  | 'ROLLBACK_DETECTED'
  | 'INCIDENT_LINKED';

export interface EngineeringSignal {
  id: string;
  type: EngineeringSignalType;
  repo: string;
  timestamp: string;
  title: string;
  body: string;
  file?: string;
  branch?: string;
  actor?: string;
  source: Provenance;
  metadata: Record<string, string | number | boolean | string[]>;
}

export interface NormalizedSignal extends EngineeringSignal {
  keywords: string[];
  riskTags: string[];
  entities: {
    repositories: string[];
    files: string[];
    incidents: string[];
    pullRequests: string[];
    commits: string[];
    workItems: string[];
    dependencies: string[];
  };
}

export interface AzureRepository {
  id: string;
  name: string;
  defaultBranch: string;
  project: string;
  dependencies: string[];
}

export interface AzureBranch {
  name: string;
  repo: string;
  lastCommit: string;
  createdBy: string;
}

export interface AzurePullRequest {
  id: string;
  repo: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'abandoned';
  sourceBranch: string;
  targetBranch: string;
  createdBy: string;
  createdAt: string;
  mergedAt?: string;
  workItemIds: string[];
  commitIds: string[];
  tags: string[];
}

export interface AzurePullRequestDetails extends AzurePullRequest {
  comments: string[];
  changedFiles: string[];
  linkedIncidentIds: string[];
  rollbackOf?: string;
}

export interface AzureCommit {
  id: string;
  repo: string;
  branch: string;
  message: string;
  author: string;
  timestamp: string;
  files: string[];
}

export interface AzureWorkItem {
  id: string;
  type: 'Incident' | 'Bug' | 'Story' | 'Task';
  title: string;
  description: string;
  state: 'Active' | 'Resolved' | 'Closed';
  repo: string;
  severity?: 'SEV1' | 'SEV2' | 'SEV3';
  tags: string[];
  createdAt: string;
}

export interface RepositoryConnection {
  fromRepo: string;
  toRepo: string;
  relation: 'depends_on' | 'publishes_to' | 'consumes_from' | 'shared_incident' | 'shared_pattern';
  reason: string;
  confidence: number;
}
