import { describe, expect, it } from "vitest";
import { LocalMemoryStore } from "../src/local-store.js";
import type { MemoryRecord } from "../src/types.js";

const records: MemoryRecord[] = [
  {
    id: "a",
    source: "codex",
    agent: "codex",
    project: "zenn-docs",
    kind: "workflow",
    content: "Zenn記事は published:false と ignorePublish を確認してから公開する。",
    metadata: {},
  },
  {
    id: "b",
    source: "claude-code",
    agent: "claude-code",
    project: "agent-memory-lab",
    kind: "review",
    content: "ベクトル検索と全文検索を RRF で混ぜて、固有名詞と意味の両方を拾う。",
    metadata: {},
  },
];

describe("LocalMemoryStore", () => {
  it("retrieves exact workflow tokens through keyword path", () => {
    const store = new LocalMemoryStore(records);
    const result = store.hybridSearch("ignorePublish published:false", { limit: 1 });
    expect(result.hits[0].record.id).toBe("a");
  });

  it("supports project filtering", () => {
    const store = new LocalMemoryStore(records);
    const result = store.hybridSearch("全文検索 RRF", { project: "agent-memory-lab", limit: 3 });
    expect(result.hits.map((hit) => hit.record.id)).toEqual(["b"]);
  });
});
