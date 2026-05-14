import { describe, expect, it } from "vitest";
import { reciprocalRankFusion } from "../src/fusion.js";
import type { MemoryRecord, RankedHit } from "../src/types.js";

function hit(id: string, rank: number, reason: RankedHit["reason"]): RankedHit {
  const record: MemoryRecord = {
    id,
    source: "codex",
    agent: "codex",
    project: "agent-memory-lab",
    kind: "test",
    content: id,
    metadata: {},
  };
  return { record, rank, score: 1 / rank, reason };
}

describe("reciprocalRankFusion", () => {
  it("promotes records that appear in both result sets", () => {
    const result = reciprocalRankFusion(
      [hit("semantic-only", 1, "vector"), hit("both", 2, "vector")],
      [hit("both", 1, "fulltext"), hit("keyword-only", 2, "fulltext")],
    );

    expect(result[0].record.id).toBe("both");
    expect(result[0].reason).toBe("hybrid");
  });
});
