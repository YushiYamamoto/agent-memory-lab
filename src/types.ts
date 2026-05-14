export type MemorySource = "codex" | "claude-code" | "manual";

export type MemoryRecord = {
  id: string;
  source: MemorySource | string;
  agent: string;
  project: string;
  kind: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt?: string;
};

export type RankedHit = {
  record: MemoryRecord;
  rank: number;
  score: number;
  reason: "vector" | "fulltext" | "hybrid" | "keyword";
  distance?: number;
};

export type SearchOptions = {
  limit?: number;
  project?: string;
  agent?: string;
};

export type SearchResult = {
  query: string;
  hits: RankedHit[];
  store: "local" | "tidb";
};
