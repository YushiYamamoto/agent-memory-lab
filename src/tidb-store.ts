import fs from "node:fs";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { EMBEDDING_DIMENSIONS, embedText, vectorLiteral } from "./embedding.js";
import { reciprocalRankFusion } from "./fusion.js";
import type { MemoryRecord, RankedHit, SearchOptions, SearchResult } from "./types.js";

const EnvSchema = z.object({
  TIDB_HOST: z.string().min(1),
  TIDB_PORT: z.coerce.number().int().positive().default(4000),
  TIDB_USER: z.string().min(1),
  TIDB_PASSWORD: z.string().min(1),
  TIDB_DATABASE: z.string().regex(/^[A-Za-z0-9_]+$/).default("agent_memory_lab"),
  TIDB_SSL_CA: z.string().optional(),
});

export type TidbEnv = z.infer<typeof EnvSchema>;

export function readTidbEnv(env: NodeJS.ProcessEnv = process.env): TidbEnv {
  return EnvSchema.parse(env);
}

export function createTidbPool(env = readTidbEnv()): Pool {
  return mysql.createPool({
    host: env.TIDB_HOST,
    port: env.TIDB_PORT,
    user: env.TIDB_USER,
    password: env.TIDB_PASSWORD,
    connectionLimit: 4,
    ssl: env.TIDB_SSL_CA
      ? {
          ca: fs.readFileSync(env.TIDB_SSL_CA, "utf8"),
          minVersion: "TLSv1.2",
        }
      : { minVersion: "TLSv1.2" },
  });
}

export const CREATE_TABLE_SQL = buildCreateTableSql("agent_memory_lab");

export function buildCreateDatabaseSql(database: string): string {
  return `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(database)}`;
}

export function buildCreateTableSql(database: string): string {
  return `
CREATE TABLE IF NOT EXISTS ${qualifiedTable(database)} (
  id VARCHAR(128) PRIMARY KEY,
  source VARCHAR(64) NOT NULL,
  agent VARCHAR(64) NOT NULL,
  project VARCHAR(255) NOT NULL,
  kind VARCHAR(64) NOT NULL,
  content TEXT NOT NULL,
  content_vec VECTOR(${EMBEDDING_DIMENSIONS}) NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FULLTEXT INDEX ft_agent_memories_content (content) WITH PARSER MULTILINGUAL
);
`.trim();
}

export class TidbMemoryStore {
  constructor(
    private readonly pool: Pool,
    private readonly database = readTidbEnv().TIDB_DATABASE,
  ) {}

  async ensureSchema(): Promise<void> {
    await this.pool.execute(buildCreateDatabaseSql(this.database));
    await this.pool.execute(buildCreateTableSql(this.database));
  }

  async upsert(record: MemoryRecord): Promise<void> {
    const vector = vectorLiteral(embedText(record.content));
    await this.pool.execute(
      `
      INSERT INTO ${qualifiedTable(this.database)}
        (id, source, agent, project, kind, content, content_vec, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE
        source = VALUES(source),
        agent = VALUES(agent),
        project = VALUES(project),
        kind = VALUES(kind),
        content = VALUES(content),
        content_vec = VALUES(content_vec),
        metadata = VALUES(metadata)
      `,
      [
        record.id,
        record.source,
        record.agent,
        record.project,
        record.kind,
        record.content,
        vector,
        JSON.stringify(record.metadata ?? {}),
      ],
    );
  }

  async bulkUpsert(records: MemoryRecord[]): Promise<void> {
    for (const record of records) {
      await this.upsert(record);
    }
  }

  async hybridSearch(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const [vectorHits, fulltextHits] = await Promise.all([
      this.vectorSearch(query, options),
      this.fullTextSearch(query, options),
    ]);

    return {
      query,
      hits: reciprocalRankFusion(vectorHits, fulltextHits).slice(0, options.limit ?? 5),
      store: "tidb",
    };
  }

  async vectorSearch(query: string, options: SearchOptions = {}): Promise<RankedHit[]> {
    const limit = options.limit ?? 5;
    const where = buildWhere(options);
    const sql = `
      SELECT id, source, agent, project, kind, content, metadata, created_at,
        VEC_COSINE_DISTANCE(content_vec, ?) AS distance
      FROM ${qualifiedTable(this.database)}
      ${where.sql}
      ORDER BY distance
      LIMIT ?
    `;
    const [rows] = (await this.pool.execute({
      sql,
      values: [vectorLiteral(embedText(query)), ...where.params, limit * 3],
    })) as [RowDataPacket[], unknown];

    return rows.map((row, index) => ({
      record: rowToRecord(row),
      rank: index + 1,
      score: 1 - Number(row.distance),
      reason: "vector",
      distance: Number(row.distance),
    }));
  }

  async fullTextSearch(query: string, options: SearchOptions = {}): Promise<RankedHit[]> {
    const limit = options.limit ?? 5;
    const where = buildWhere(options, "FTS_MATCH_WORD(?, content)");
    const sql = `
      SELECT id, source, agent, project, kind, content, metadata, created_at,
        FTS_MATCH_WORD(?, content) AS score
      FROM ${qualifiedTable(this.database)}
      ${where.sql}
      ORDER BY score DESC
      LIMIT ?
    `;
    const [rows] = (await this.pool.execute({
      sql,
      values: [query, query, ...where.params, limit * 3],
    })) as [RowDataPacket[], unknown];

    return rows.map((row, index) => ({
      record: rowToRecord(row),
      rank: index + 1,
      score: Number(row.score),
      reason: "fulltext",
    }));
  }
}

export function qualifiedTable(database: string): string {
  return `${quoteIdentifier(database)}.agent_memories`;
}

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `\`${identifier}\``;
}

function buildWhere(options: SearchOptions, firstPredicate?: string): { sql: string; params: unknown[] } {
  const predicates: string[] = [];
  const params: unknown[] = [];
  if (firstPredicate) predicates.push(firstPredicate);
  if (options.project) {
    predicates.push("project = ?");
    params.push(options.project);
  }
  if (options.agent) {
    predicates.push("agent = ?");
    params.push(options.agent);
  }

  return {
    sql: predicates.length ? `WHERE ${predicates.join(" AND ")}` : "",
    params,
  };
}

function rowToRecord(row: RowDataPacket): MemoryRecord {
  return {
    id: String(row.id),
    source: String(row.source),
    agent: String(row.agent),
    project: String(row.project),
    kind: String(row.kind),
    content: String(row.content),
    metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : (row.metadata ?? {}),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
  };
}
