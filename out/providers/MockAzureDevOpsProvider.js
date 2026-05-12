"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockAzureDevOpsProvider = void 0;
const enterpriseMockData_1 = require("../mock/enterpriseMockData");
class MockAzureDevOpsProvider {
    constructor() {
        this.repositories = [...enterpriseMockData_1.mockRepositories];
        this.branches = [...enterpriseMockData_1.mockBranches];
        this.commits = [...enterpriseMockData_1.mockCommits];
        this.pullRequests = [...enterpriseMockData_1.mockPullRequests];
        this.workItems = [...enterpriseMockData_1.mockWorkItems];
        this.connections = [...enterpriseMockData_1.mockConnections];
    }
    async getPullRequests(repo) {
        // TODO: REAL AZ CLI IMPLEMENTATION HERE
        return this.filterByRepo(this.pullRequests, repo).map(({ comments, changedFiles, linkedIncidentIds, rollbackOf, ...pr }) => pr);
    }
    async getPullRequestDetails(repo, pullRequestId) {
        // TODO: REAL AZ CLI IMPLEMENTATION HERE
        return this.pullRequests.find((pr) => pr.repo === repo && pr.id === pullRequestId) ?? null;
    }
    async getRecentCommits(repo, limit = 25) {
        // TODO: REAL AZ CLI IMPLEMENTATION HERE
        return this.filterByRepo(this.commits, repo).slice(0, limit);
    }
    async getRepositories() {
        // TODO: REAL AZ CLI IMPLEMENTATION HERE
        return [...this.repositories];
    }
    async getBranches(repo) {
        // TODO: REAL AZ CLI IMPLEMENTATION HERE
        return this.filterByRepo(this.branches, repo);
    }
    async getWorkItems(repo) {
        // TODO: REAL AZ CLI IMPLEMENTATION HERE
        return this.filterByRepo(this.workItems, repo);
    }
    async getRepositoryConnections(repo) {
        // TODO: REAL AZ CLI IMPLEMENTATION HERE
        if (!repo)
            return [...this.connections];
        return this.connections.filter((connection) => connection.fromRepo === repo || connection.toRepo === repo);
    }
    simulateMergedPullRequest(repo) {
        const pr = this.pullRequests.find((candidate) => candidate.repo === repo && candidate.status === 'active');
        if (!pr)
            return null;
        pr.status = 'completed';
        pr.mergedAt = new Date().toISOString();
        pr.tags = [...new Set([...pr.tags, 'canonicalized'])];
        return pr;
    }
    filterByRepo(items, repo) {
        return repo ? items.filter((item) => item.repo === repo) : [...items];
    }
}
exports.MockAzureDevOpsProvider = MockAzureDevOpsProvider;
//# sourceMappingURL=MockAzureDevOpsProvider.js.map