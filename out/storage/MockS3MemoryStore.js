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
exports.MockS3MemoryStore = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class MockS3MemoryStore {
    constructor(storageRoot) {
        this.storageRoot = storageRoot;
        this.loaded = false;
        this.data = { memories: [], packets: [], timeline: [] };
    }
    async saveMemory(memory) {
        // TODO: REAL S3 IMPLEMENTATION HERE
        await this.ensureLoaded();
        const index = this.data.memories.findIndex((item) => item.id === memory.id);
        if (index >= 0) {
            this.data.memories[index] = memory;
        }
        else {
            this.data.memories.push(memory);
        }
        this.upsertTimeline(memory);
        await this.persist();
    }
    async getMemories(query = {}) {
        // TODO: REAL S3 IMPLEMENTATION HERE
        await this.ensureLoaded();
        return this.applyQuery(this.data.memories, query);
    }
    async updateMemory(memoryId, patch) {
        // TODO: REAL S3 IMPLEMENTATION HERE
        await this.ensureLoaded();
        const current = this.data.memories.find((item) => item.id === memoryId);
        if (!current)
            return null;
        const updated = { ...current, ...patch };
        await this.saveMemory(updated);
        return updated;
    }
    async queryMemories(query) {
        // TODO: REAL S3 IMPLEMENTATION HERE
        return this.getMemories(query);
    }
    async saveCompressedPacket(packet) {
        // TODO: REAL S3 IMPLEMENTATION HERE
        await this.ensureLoaded();
        const index = this.data.packets.findIndex((item) => item.id === packet.id);
        if (index >= 0)
            this.data.packets[index] = packet;
        else
            this.data.packets.push(packet);
        await this.persist();
    }
    async getTimeline(repo) {
        // TODO: REAL S3 IMPLEMENTATION HERE
        await this.ensureLoaded();
        return this.data.timeline
            .filter((event) => !repo || event.repo === repo)
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }
    async ensureLoaded() {
        if (this.loaded)
            return;
        try {
            const raw = await fs.readFile(this.filePath(), 'utf8');
            this.data = JSON.parse(raw);
        }
        catch {
            this.data = { memories: [], packets: [], timeline: [] };
        }
        this.loaded = true;
    }
    async persist() {
        await fs.mkdir(this.storageRoot, { recursive: true });
        await fs.writeFile(this.filePath(), JSON.stringify(this.data, null, 2), 'utf8');
    }
    filePath() {
        return path.join(this.storageRoot, 'axiom-organizational-memory.mock-s3.json');
    }
    applyQuery(memories, query) {
        const text = query.text?.toLowerCase();
        const tags = query.tags ?? [];
        return memories
            .filter((memory) => !query.repo || memory.repo === query.repo)
            .filter((memory) => !query.file || memory.file === query.file || memory.relatedEntities.some((entity) => entity.kind === 'file' && entity.label === query.file))
            .filter((memory) => !query.type || memory.type === query.type)
            .filter((memory) => !query.state || memory.state === query.state)
            .filter((memory) => tags.every((tag) => memory.tags.includes(tag)))
            .filter((memory) => !text || `${memory.summary} ${memory.tags.join(' ')}`.toLowerCase().includes(text))
            .sort((a, b) => b.confidence - a.confidence || b.timestamp.localeCompare(a.timestamp))
            .slice(0, query.limit ?? memories.length);
    }
    upsertTimeline(memory) {
        const event = {
            id: `timeline:${memory.id}`,
            repo: memory.repo,
            timestamp: memory.timestamp,
            title: memory.type.replace(/_/g, ' ').toLowerCase(),
            description: memory.summary,
            type: memory.type,
            provenance: memory.source,
        };
        const index = this.data.timeline.findIndex((item) => item.id === event.id);
        if (index >= 0)
            this.data.timeline[index] = event;
        else
            this.data.timeline.push(event);
    }
}
exports.MockS3MemoryStore = MockS3MemoryStore;
//# sourceMappingURL=MockS3MemoryStore.js.map