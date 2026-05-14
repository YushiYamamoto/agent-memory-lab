export const EMBEDDING_DIMENSIONS = 64;

const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;

export function tokenize(input: string): string[] {
  const normalized = input
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}_./:-]+/gu, " ")
    .trim();

  const wordTokens = normalized.split(/\s+/).filter(Boolean);
  const cjkChars = [...normalized].filter((char) => CJK_RE.test(char));
  const cjkBigrams = cjkChars
    .slice(0, -1)
    .map((char, index) => `${char}${cjkChars[index + 1]}`);

  return [...wordTokens, ...cjkBigrams];
}

export function embedText(input: string, dimensions = EMBEDDING_DIMENSIONS): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of tokenize(input)) {
    const hash = fnv1a(token);
    const bucket = hash % dimensions;
    const sign = hash & 1 ? 1 : -1;
    vector[bucket] += sign * Math.log2(token.length + 1);
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

export function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} !== ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  if (normA === 0 || normB === 0) return 1;
  return 1 - dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function vectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => Number(value.toFixed(6))).join(",")}]`;
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
