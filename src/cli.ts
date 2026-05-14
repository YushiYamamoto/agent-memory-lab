#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import dotenv from "dotenv";
import { LocalMemoryStore } from "./local-store.js";
import { createTidbPool, readTidbEnv, TidbMemoryStore } from "./tidb-store.js";
import { readJsonl } from "./io.js";
import { buildRrfSql, buildSqlEditorScript } from "./sql-export.js";

dotenv.config({ quiet: true });

const program = new Command();

program
  .name("agent-memory-lab")
  .description("Hybrid agent memory search with TiDB Cloud vector and full-text search.")
  .option("--store <store>", "tidb or local", process.env.MEMORY_STORE ?? "local");

program
  .command("doctor")
  .description("Check runtime configuration without printing secrets.")
  .action(async () => {
    const store = program.opts<{ store: string }>().store;
    if (store === "local") {
      console.log("store=local");
      console.log("tidb=skipped");
      return;
    }

    const env = readTidbEnv();
    console.log(`store=tidb`);
    console.log(`host=${env.TIDB_HOST}`);
    console.log(`port=${env.TIDB_PORT}`);
    console.log(`user=${maskUser(env.TIDB_USER)}`);
    console.log(`database=${env.TIDB_DATABASE}`);
    console.log(`tls=${env.TIDB_SSL_CA ? `ca:${env.TIDB_SSL_CA}` : "enabled"}`);

    const pool = createTidbPool(env);
    try {
      const [rows] = await pool.query("SELECT VERSION() AS version");
      console.log(JSON.stringify(rows, null, 2));
    } finally {
      await pool.end();
    }
  });

program
  .command("seed")
  .description("Create schema and seed memory records.")
  .option("--sample", "use data/sample-memories.jsonl")
  .option("--file <path>", "JSONL memory file")
  .action(async (options: { sample?: boolean; file?: string }) => {
    const file = options.file ?? (options.sample ? "data/sample-memories.jsonl" : undefined);
    if (!file) throw new Error("Pass --sample or --file <path>.");
    const records = await readJsonl(path.resolve(file));
    const store = program.opts<{ store: string }>().store;

    if (store === "local") {
      console.log(`loaded=${records.length}`);
      console.log("store=local");
      return;
    }

    const pool = createTidbPool();
    try {
      const tidb = new TidbMemoryStore(pool);
      await tidb.ensureSchema();
      await tidb.bulkUpsert(records);
      console.log(`seeded=${records.length}`);
      console.log("store=tidb");
    } finally {
      await pool.end();
    }
  });

program
  .command("search")
  .description("Run hybrid search.")
  .argument("<query>", "query text")
  .option("-l, --limit <n>", "number of results", (value) => Number.parseInt(value, 10), 5)
  .option("--project <name>", "filter by project")
  .option("--agent <name>", "filter by agent")
  .option("--file <path>", "JSONL file for local store", "data/sample-memories.jsonl")
  .action(async (query: string, options: { limit: number; project?: string; agent?: string; file: string }) => {
    const store = program.opts<{ store: string }>().store;
    if (store === "local") {
      const records = await readJsonl(path.resolve(options.file));
      const local = new LocalMemoryStore(records);
      printResult(local.hybridSearch(query, options));
      return;
    }

    const pool = createTidbPool();
    try {
      const tidb = new TidbMemoryStore(pool);
      printResult(await tidb.hybridSearch(query, options));
    } finally {
      await pool.end();
    }
  });

program
  .command("sql-editor")
  .description("Print a TiDB Cloud SQL Editor script for schema and sample data.")
  .option("--sample", "use data/sample-memories.jsonl")
  .option("--file <path>", "JSONL memory file")
  .option("--database <name>", "database name", process.env.TIDB_DATABASE ?? "agent_memory_lab")
  .action(async (options: { sample?: boolean; file?: string; database: string }) => {
    const file = options.file ?? (options.sample ? "data/sample-memories.jsonl" : undefined);
    if (!file) throw new Error("Pass --sample or --file <path>.");
    const records = await readJsonl(path.resolve(file));
    console.log(buildSqlEditorScript(records, options.database));
  });

program
  .command("rrf-sql")
  .description("Print a TiDB SQL Editor query that fuses vector and full-text ranks with RRF.")
  .argument("[query]", "semantic query", "Claude Code の検索で ignorePublish を落としたくない")
  .option("--fulltext <query>", "full-text query", "ignorePublish published:false")
  .option("--database <name>", "database name", process.env.TIDB_DATABASE ?? "agent_memory_lab")
  .action((query: string, options: { fulltext: string; database: string }) => {
    console.log(buildRrfSql(query, options.fulltext, options.database));
  });

await program.parseAsync();

function printResult(result: Awaited<ReturnType<LocalMemoryStore["hybridSearch"]>>): void {
  console.log(JSON.stringify(result, null, 2));
}

function maskUser(user: string): string {
  const [prefix, suffix] = user.split(".");
  if (!suffix) return "***";
  return `${prefix.slice(0, 3)}***.${suffix}`;
}
