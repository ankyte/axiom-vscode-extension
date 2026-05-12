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
exports.hashId = hashId;
exports.compactText = compactText;
exports.tokenize = tokenize;
exports.toMockEmbedding = toMockEmbedding;
exports.cosineSim = cosineSim;
exports.topN = topN;
const crypto = __importStar(require("crypto"));
function hashId(input) {
    return crypto.createHash('sha1').update(input).digest('hex').slice(0, 12);
}
function compactText(text, max = 220) {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean;
}
function tokenize(input) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9_\-\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 2);
}
function toMockEmbedding(text, dims = 24) {
    const vector = new Array(dims).fill(0);
    const tokens = tokenize(text);
    for (const token of tokens) {
        const h = crypto.createHash('md5').update(token).digest();
        for (let i = 0; i < dims; i++) {
            vector[i] += (h[i % h.length] / 255) * (token.length % 7);
        }
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => Number((value / norm).toFixed(6)));
}
function cosineSim(a, b) {
    if (a.length !== b.length) {
        return 0;
    }
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
}
function topN(items, score, n) {
    return [...items]
        .map((item) => ({ item, s: score(item) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, n)
        .map((it) => it.item);
}
//# sourceMappingURL=utils.js.map