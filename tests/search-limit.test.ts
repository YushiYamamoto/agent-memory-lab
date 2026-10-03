import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Pool } from "mysql2/promise";
import { LocalMemoryStore } from "../src/local-store.js";
import { TidbMemoryStore } from "../src/tidb-store.js";
import type { MemoryRecord } from "../src/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function memory(id: string, content = `${id} ignorePublish memory`): MemoryRecord {
  return {
    id,
    source: "manual",
    agent: "human",
    project: "agent-memory-lab",
    kind: "note",
    content,
    metadata: {},
  };
}

function runSearch(args: string[]) {
  return spawnSync(
    process.execPath,
    [path.join(root, "node_modules/tsx/dist/cli.mjs"), path.join(root, "src/cli.ts"), "search", ...args],
    { cwd: root, encoding: "utf8" },
  );
}

describe("LocalMemoryStore limit", () => {
  const store = new LocalMemoryStore([memory("a"), memory("b"), memory("c")]);

  it.each([0, -1, 2.9, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects %s",
    (limit) => {
      expect(() => store.hybridSearch("ignorePublish", { limit })).toThrow(/positive integer >= 1/);
    },
  );

  it("uses 5 when limit is omitted and keeps a positive integer", () => {
    const many = new LocalMemoryStore(Array.from({ length: 8 }, (_, index) => memory(`m${index}`)));
    expect(many.hybridSearch("ignorePublish").hits).toHaveLength(5);
    expect(many.hybridSearch("ignorePublish", { limit: 2 }).hits).toHaveLength(2);
    expect(many.hybridSearch("ignorePublish", { limit: 1 }).hits).toHaveLength(1);
  });
});

describe("TidbMemoryStore limit", () => {
  function storeWithPool() {
    const calls: unknown[] = [];
    const pool = {
      async execute(...args: unknown[]) {
        calls.push(args);
        throw new Error("should not query");
      },
    } as unknown as Pool;
    return { store: new TidbMemoryStore(pool, "agent_memory_lab"), calls };
  }

  it.each([
    ["hybridSearch", -1],
    ["vectorSearch", 0],
    ["fullTextSearch", 2.9],
  ] as const)("rejects %s limit %s before querying", async (method, limit) => {
    const { store, calls } = storeWithPool();
    await expect(store[method]("ignorePublish", { limit })).rejects.toThrow(/positive integer >= 1/);
    expect(calls).toEqual([]);
  });
});

describe("CLI --limit", () => {
  it.each(["0", "-1", "2.9", "1.0", "foo", "", "01", "+5", "2abc"])(
    "rejects %j with a non-zero exit",
    (value) => {
      const result = runSearch(["--store", "local", "ignorePublish", "--limit", value]);
      const output = `${result.stderr}\n${result.stdout}`;
      expect(result.status, output).not.toBe(0);
      expect(output).toMatch(/positive integer >= 1/);
    },
  );

  it("rejects the short -l form", () => {
    const result = runSearch(["--store", "local", "ignorePublish", "-l", "0"]);
    const output = `${result.stderr}\n${result.stdout}`;
    expect(result.status, output).not.toBe(0);
    expect(output).toMatch(/positive integer >= 1/);
  });

  it("keeps the default of 5 when --limit is omitted", () => {
    const result = runSearch(["--store", "local", "ignorePublish"]);
    expect(result.status, result.stderr).toBe(0);
    const parsed = JSON.parse(result.stdout) as { hits: unknown[] };
    expect(parsed.hits).toHaveLength(5);
  });

  it("accepts a positive integer", () => {
    const result = runSearch(["--store", "local", "ignorePublish published:false", "--limit", "1"]);
    expect(result.status, result.stderr).toBe(0);
    const parsed = JSON.parse(result.stdout) as { hits: Array<{ record: { id: string } }> };
    expect(parsed.hits).toHaveLength(1);
    expect(parsed.hits[0]?.record.id).toBe("codex-zenn-skill-001");
  });
});
