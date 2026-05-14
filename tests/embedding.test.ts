import { describe, expect, it } from "vitest";
import { EMBEDDING_DIMENSIONS, cosineDistance, embedText, tokenize, vectorLiteral } from "../src/embedding.js";

describe("embedding", () => {
  it("creates deterministic normalized vectors", () => {
    const a = embedText("TiDB Cloud hybrid search");
    const b = embedText("TiDB Cloud hybrid search");
    expect(a).toEqual(b);
    expect(a).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(cosineDistance(a, b)).toBeCloseTo(0, 5);
  });

  it("keeps Japanese and exact-token signals", () => {
    expect(tokenize("ignorePublish と 全文検索")).toContain("ignorepublish");
    expect(tokenize("ignorePublish と 全文検索")).toContain("全文");
  });

  it("renders TiDB vector literals", () => {
    expect(vectorLiteral([0.1, 0.23456789])).toBe("[0.1,0.234568]");
  });
});
