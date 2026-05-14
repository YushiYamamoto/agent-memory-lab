import { describe, expect, it } from "vitest";
import { CREATE_TABLE_SQL } from "../src/tidb-store.js";
import { EMBEDDING_DIMENSIONS } from "../src/embedding.js";

describe("TiDB SQL", () => {
  it("declares vector and multilingual full-text columns in one table", () => {
    expect(CREATE_TABLE_SQL).toContain(`content_vec VECTOR(${EMBEDDING_DIMENSIONS})`);
    expect(CREATE_TABLE_SQL).toContain("FULLTEXT INDEX ft_agent_memories_content (content) WITH PARSER MULTILINGUAL");
  });
});
