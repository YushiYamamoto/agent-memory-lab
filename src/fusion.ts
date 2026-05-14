import type { RankedHit } from "./types.js";

export type FusionWeights = {
  vector?: number;
  fulltext?: number;
  rrfK?: number;
};

export function reciprocalRankFusion(
  vectorHits: RankedHit[],
  fulltextHits: RankedHit[],
  weights: FusionWeights = {},
): RankedHit[] {
  const vectorWeight = weights.vector ?? 1;
  const fulltextWeight = weights.fulltext ?? 1;
  const k = weights.rrfK ?? 60;
  const byId = new Map<string, RankedHit>();

  for (const hit of vectorHits) {
    const current = byId.get(hit.record.id);
    const score = vectorWeight / (k + hit.rank);
    byId.set(hit.record.id, mergeHit(current, hit, score));
  }

  for (const hit of fulltextHits) {
    const current = byId.get(hit.record.id);
    const score = fulltextWeight / (k + hit.rank);
    byId.set(hit.record.id, mergeHit(current, hit, score));
  }

  return [...byId.values()]
    .sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id))
    .map((hit, index) => ({ ...hit, rank: index + 1, reason: "hybrid" }));
}

function mergeHit(current: RankedHit | undefined, next: RankedHit, scoreDelta: number): RankedHit {
  if (!current) {
    return { ...next, score: scoreDelta, reason: "hybrid" };
  }

  return {
    ...current,
    score: current.score + scoreDelta,
    distance: Math.min(current.distance ?? Number.POSITIVE_INFINITY, next.distance ?? Number.POSITIVE_INFINITY),
    reason: "hybrid",
  };
}
