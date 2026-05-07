import * as crypto from 'crypto';

export function hashId(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 12);
}

export function compactText(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean;
}

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export function toMockEmbedding(text: string, dims = 24): number[] {
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

export function cosineSim(a: number[], b: number[]): number {
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

export function topN<T>(items: T[], score: (item: T) => number, n: number): T[] {
  return [...items]
    .map((item) => ({ item, s: score(item) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((it) => it.item);
}
