import { cosineDistance, embedText, tokenize } from "./embedding.js";
import { reciprocalRankFusion } from "./fusion.js";
import type { MemoryRecord, RankedHit, SearchOptions, SearchResult } from "./types.js";

export class LocalMemoryStore {
  private readonly rows: Array<MemoryRecord & { embedding: number[] }>;

  constructor(records: MemoryRecord[]) {
    this.rows = records.map((record) => ({
      ...record,
      embedding: embedText(record.content),
    }));
  }

  hybridSearch(query: string, options: SearchOptions = {}): SearchResult {
    const limit = options.limit ?? 5;
    const candidates = this.rows.filter((record) => {
      if (options.project && record.project !== options.project) return false;
      if (options.agent && record.agent !== options.agent) return false;
      return true;
    });

    const queryEmbedding = embedText(query);
    const vectorHits: RankedHit[] = candidates
      .map((record) => {
        const distance = cosineDistance(queryEmbedding, record.embedding);
        return {
          record: toPublicRecord(record),
          rank: 0,
          score: 1 - distance,
          reason: "vector" as const,
          distance,
        };
      })
      .sort((a, b) => (a.distance ?? 1) - (b.distance ?? 1))
      .slice(0, limit * 3)
      .map((hit, index) => ({ ...hit, rank: index + 1 }));

    const fulltextHits: RankedHit[] = candidates
      .map((record) => ({
        record: toPublicRecord(record),
        rank: 0,
        score: keywordScore(query, record.content),
        reason: "keyword" as const,
      }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit * 3)
      .map((hit, index) => ({ ...hit, rank: index + 1 }));

    return {
      query,
      hits: reciprocalRankFusion(vectorHits, fulltextHits).slice(0, limit),
      store: "local",
    };
  }
}

function toPublicRecord(record: MemoryRecord & { embedding: number[] }): MemoryRecord {
  const { embedding: _embedding, ...publicRecord } = record;
  return publicRecord;
}

export function keywordScore(query: string, content: string): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;

  const contentTokens = tokenize(content);
  const contentSet = new Set(contentTokens);
  let score = 0;

  for (const token of queryTokens) {
    if (contentSet.has(token)) {
      score += token.length >= 4 ? 2 : 1;
    }
  }

  const phraseBonus = content.toLowerCase().includes(query.toLowerCase()) ? 3 : 0;
  return score + phraseBonus;
}
