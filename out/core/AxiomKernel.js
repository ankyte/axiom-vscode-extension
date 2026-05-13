"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AxiomKernel = void 0;
const path = __importStar(require("path"));
const ArchitectureRuleProvider_1 = require("../architecture/ArchitectureRuleProvider");
const SemanticCompressionEngine_1 = require("../compression/SemanticCompressionEngine");
const RelationshipEngine_1 = require("../graph/RelationshipEngine");
const IngestionPipeline_1 = require("../ingestion/IngestionPipeline");
const LocalSignalCollector_1 = require("../ingestion/LocalSignalCollector");
const RemoteSignalMapper_1 = require("../ingestion/RemoteSignalMapper");
const SignalNormalizer_1 = require("../ingestion/SignalNormalizer");
const DriftDetectionEngine_1 = require("../memory/DriftDetectionEngine");
const MemoryExtractionEngine_1 = require("../memory/MemoryExtractionEngine");
const MockAzureDevOpsProvider_1 = require("../providers/MockAzureDevOpsProvider");
const MockEmbeddingProvider_1 = require("../providers/MockEmbeddingProvider");
const MockLLMProvider_1 = require("../providers/MockLLMProvider");
const RiskEngine_1 = require("../risk/RiskEngine");
const ContextRetrievalEngine_1 = require("../retrieval/ContextRetrievalEngine");
const MockS3MemoryStore_1 = require("../storage/MockS3MemoryStore");
const TimelineEngine_1 = require("../timeline/TimelineEngine");
const utils_1 = require("../utils");
class AxiomKernel {
    constructor(options) {
        this.relationships = new RelationshipEngine_1.RelationshipEngine();
        this.connectedRepos = new Set();
        this.azure = options.azure ?? new MockAzureDevOpsProvider_1.MockAzureDevOpsProvider();
        this.store = options.store ?? new MockS3MemoryStore_1.MockS3MemoryStore(options.storageRoot);
        this.embeddings = options.embeddings ?? new MockEmbeddingProvider_1.MockEmbeddingProvider();
        this.llm = options.llm ?? new MockLLMProvider_1.MockLLMProvider();
        this.workspaceRoot = options.workspaceRoot;
        this.localSignals = new LocalSignalCollector_1.LocalSignalCollector(options.storageRoot);
        this.ruleProvider = new ArchitectureRuleProvider_1.ArchitectureRuleProvider(this.store, this.workspaceRoot);
        const defaultRepo = options.workspaceRoot ? path.basename(options.workspaceRoot) : 'pricing-service';
        this.activeContext = { repo: defaultRepo };
        this.remoteSignals = new RemoteSignalMapper_1.RemoteSignalMapper(this.azure);
        this.pipeline = new IngestionPipeline_1.IngestionPipeline(new SignalNormalizer_1.SignalNormalizer(), new MemoryExtractionEngine_1.MemoryExtractionEngine(this.embeddings, this.llm), this.store);
        this.retrieval = new ContextRetrievalEngine_1.ContextRetrievalEngine(this.store, this.embeddings, this.relationships, new SemanticCompressionEngine_1.SemanticCompressionEngine(this.llm), new RiskEngine_1.RiskEngine(), new DriftDetectionEngine_1.DriftDetectionEngine(), new TimelineEngine_1.TimelineEngine(), (repo) => this.azure.getRepositoryConnections(repo), (repo) => this.ruleProvider.getRules(repo).then((rules) => {
            this.lastRuleRefreshAt = rules.loadedAt;
            return rules;
        }));
    }
    async bootstrap() {
        const repos = await this.azure.getRepositories();
        const repoNames = repos.map((repo) => repo.name);
        const preferred = repoNames.includes(this.activeContext.repo) ? this.activeContext.repo : 'pricing-service';
        await this.connectRepository(preferred);
        if (this.workspaceRoot && preferred !== this.activeContext.repo) {
            await this.connectRepository(this.activeContext.repo);
        }
    }
    startPolling(intervalMs = 30000, onPoll) {
        if (this.poller)
            return;
        this.poller = setInterval(() => {
            void this.simulateRemotePoll().then(() => onPoll?.());
        }, intervalMs);
    }
    dispose() {
        if (this.poller)
            clearInterval(this.poller);
    }
    async connectRepository(repoName) {
        this.connectedRepos.add(repoName);
        this.activeContext = { ...this.activeContext, repo: repoName };
        const remote = await this.remoteSignals.fromRepository(repoName);
        const local = this.workspaceRoot ? await this.localSignals.collect(this.workspaceRoot, repoName) : [];
        await this.pipeline.ingest([...remote, ...local]);
        this.lastLocalIngestAt = local.length ? new Date().toISOString() : this.lastLocalIngestAt;
        this.lastRemotePollAt = remote.length ? new Date().toISOString() : this.lastRemotePollAt;
        await this.indexRepositoryRelationships(repoName);
    }
    async recordActiveFile(filePath) {
        const repo = this.activeContext.repo;
        this.activeContext = { ...this.activeContext, file: filePath };
        await this.pipeline.ingest([this.localSignals.fileOpened(repo, filePath)]);
        this.lastLocalIngestAt = new Date().toISOString();
    }
    async ingestLocalCommit(message, commitId = (0, utils_1.hashId)(`${message}:${Date.now()}`), branch = 'local') {
        await this.pipeline.ingest([this.localSignals.localCommit(this.activeContext.repo, message, commitId, branch)]);
        this.lastLocalIngestAt = new Date().toISOString();
    }
    async ingestLocalFileChange(filePath) {
        if (!this.workspaceRoot)
            return;
        const signals = await this.localSignals.fileChanged(this.workspaceRoot, this.activeContext.repo, filePath);
        await this.pipeline.ingest(signals);
        if (signals.length)
            this.lastLocalIngestAt = new Date().toISOString();
    }
    async refreshLocalSignals() {
        if (!this.workspaceRoot)
            return;
        const signals = await this.localSignals.collect(this.workspaceRoot, this.activeContext.repo);
        await this.pipeline.ingest(signals);
        if (signals.length)
            this.lastLocalIngestAt = new Date().toISOString();
    }
    async handlePullRequestMerged(repo, pullRequestId) {
        const details = await this.azure.getPullRequestDetails(repo, pullRequestId);
        if (!details)
            return;
        await this.pipeline.ingest(await this.remoteSignals.fromRepository(repo));
        const memories = await this.store.getMemories({ repo });
        for (const memory of memories.filter((item) => item.source.sourceId === pullRequestId || item.relatedEntities.some((entity) => entity.id === pullRequestId))) {
            await this.store.updateMemory(memory.id, { state: 'CANONICAL', embedding: await this.embeddings.generateEmbedding(memory.summary) });
        }
    }
    async simulateRemotePoll() {
        for (const repo of this.connectedRepos) {
            await this.pipeline.ingest(await this.remoteSignals.fromRepository(repo));
        }
        this.lastRemotePollAt = new Date().toISOString();
        await this.refreshLocalSignals();
    }
    async retrieve(context = {}) {
        const merged = { ...this.activeContext, ...context };
        this.activeContext = merged;
        const existing = await this.store.getMemories({ repo: merged.repo, limit: 1 });
        if (existing.length === 0) {
            await this.connectRepository(merged.repo);
        }
        return this.retrieval.retrieve(merged);
    }
    async getGraph(repo = this.activeContext.repo) {
        const [memories, connections] = await Promise.all([this.store.getMemories({ repo }), this.azure.getRepositoryConnections(repo)]);
        return this.relationships.build(memories, connections);
    }
    getActiveContext() {
        return this.activeContext;
    }
    getConnectedRepositories() {
        return [...this.connectedRepos];
    }
    async getMemories(repo = this.activeContext.repo) {
        return this.store.getMemories({ repo });
    }
    getStatus() {
        return {
            connectedRepositories: this.getConnectedRepositories(),
            lastLocalIngestAt: this.lastLocalIngestAt,
            lastRemotePollAt: this.lastRemotePollAt,
            lastRuleRefreshAt: this.lastRuleRefreshAt,
        };
    }
    async indexRepositoryRelationships(repoName) {
        const connections = await this.azure.getRepositoryConnections(repoName);
        for (const connection of connections) {
            await this.store.saveMemory(this.relationships.relationshipMemory(repoName, connection));
            this.connectedRepos.add(connection.fromRepo);
            this.connectedRepos.add(connection.toRepo);
        }
    }
}
exports.AxiomKernel = AxiomKernel;
//# sourceMappingURL=AxiomKernel.js.map