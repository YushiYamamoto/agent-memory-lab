import { describe, expect, it } from "vitest";
import { buildRrfSql, buildSqlEditorScript } from "../src/sql-export.js";
import type { MemoryRecord } from "../src/types.js";

describe("buildSqlEditorScript", () => {
  it("exports reproducible TiDB SQL without secrets", () => {
    const records: MemoryRecord[] = [
      {
        id: "quote-test",
        source: "codex",
        agent: "codex",
        project: "agent-memory-lab",
        kind: "test",
        content: "don't drop ignorePublish",
        metadata: { ok: true },
      },
    ];
    const sql = buildSqlEditorScript(records, "agent_memory_lab");
    expect(sql).toContain("CREATE DATABASE IF NOT EXISTS `agent_memory_lab`");
    expect(sql).toContain("don''t drop ignorePublish");
    expect(sql).toContain("VECTOR(64)");
    expect(sql).not.toContain("PASSWORD");
  });

  it("exports an RRF query using TiDB vector and full-text search", () => {
    const sql = buildRrfSql("Claude Code の検索で ignorePublish を落としたくない");
    expect(sql).toContain("VEC_COSINE_DISTANCE");
    expect(sql).toContain("FTS_MATCH_WORD");
    expect(sql).toContain("rrf_score");
    expect(sql).toContain("ROW_NUMBER()");
  });
});
