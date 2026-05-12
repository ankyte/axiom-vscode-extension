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
exports.MemoryStore = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class MemoryStore {
    constructor(context) {
        this.context = context;
    }
    getPath(repoRoot) {
        const safe = repoRoot.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        return path.join(this.context.globalStorageUri.fsPath, `${safe}.axiom.json`);
    }
    async save(memory) {
        await fs.mkdir(this.context.globalStorageUri.fsPath, { recursive: true });
        await fs.writeFile(this.getPath(memory.repoRoot), JSON.stringify(memory, null, 2), 'utf8');
    }
    async load(repoRoot) {
        try {
            const raw = await fs.readFile(this.getPath(repoRoot), 'utf8');
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
}
exports.MemoryStore = MemoryStore;
//# sourceMappingURL=storage.js.map