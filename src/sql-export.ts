import { embedText, vectorLiteral } from "./embedding.js";
import { buildCreateDatabaseSql, buildCreateTableSql, qualifiedTable } from "./tidb-store.js";
import type { MemoryRecord } from "./types.js";

export function buildSqlEditorScript(records: MemoryRecord[], database = "agent_memory_lab"): string {
  const table = qualifiedTable(database);
  const inserts = records.map((record) => {
    return [
      sqlString(record.id),
      sqlString(record.source),
      sqlString(record.agent),
      sqlString(record.project),
      sqlString(record.kind),
      sqlString(record.content),
      sqlString(vectorLiteral(embedText(record.content))),
      `CAST(${sqlString(JSON.stringify(record.metadata ?? {}))} AS JSON)`,
    ].join(", ");
  });

  return [
    `${buildCreateDatabaseSql(database)};`,
    buildCreateTableSql(database),
    inserts.length
      ? `
INSERT INTO ${table}
  (id, source, agent, project, kind, content, content_vec, metadata)
VALUES
  (${inserts.join("),\n  (")})
ON DUPLICATE KEY UPDATE
  source = VALUES(source),
  agent = VALUES(agent),
  project = VALUES(project),
  kind = VALUES(kind),
  content = VALUES(content),
  content_vec = VALUES(content_vec),
  metadata = VALUES(metadata);
`.trim()
      : "",
    `
SELECT id, project, kind, content
FROM ${table}
ORDER BY created_at DESC
LIMIT 5;
`.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildRrfSql(
  query: string,
  fulltextQuery = "ignorePublish published:false",
  database = "agent_memory_lab",
): string {
  const table = qualifiedTable(database);
  const queryVector = sqlString(vectorLiteral(embedText(query)));
  const fts = sqlString(fulltextQuery);

  return `
USE ${quoteDatabase(database)};

WITH vector_hits AS (
  SELECT id, project, kind, content,
    ROW_NUMBER() OVER (
      ORDER BY VEC_COSINE_DISTANCE(content_vec, ${queryVector}) ASC
    ) AS vector_rank
  FROM ${table}
  WHERE project IN ('zenn-docs', 'agent-memory-lab')
  ORDER BY VEC_COSINE_DISTANCE(content_vec, ${queryVector}) ASC
  LIMIT 5
),
fulltext_ordered AS (
  SELECT id, project, kind, content
  FROM ${table}
  WHERE FTS_MATCH_WORD(${fts}, content)
  ORDER BY FTS_MATCH_WORD(${fts}, content) DESC
  LIMIT 5
),
fulltext_hits AS (
  SELECT id, project, kind, content,
    ROW_NUMBER() OVER () AS fulltext_rank
  FROM fulltext_ordered
),
fused AS (
  SELECT id, project, kind, content, vector_rank, NULL AS fulltext_rank FROM vector_hits
  UNION ALL
  SELECT id, project, kind, content, NULL AS vector_rank, fulltext_rank FROM fulltext_hits
)
SELECT id, project, kind,
  MIN(vector_rank) AS vector_rank,
  MIN(fulltext_rank) AS fulltext_rank,
  ROUND(SUM(
    IF(vector_rank IS NULL, 0, 1.0 / (60 + vector_rank)) +
    IF(fulltext_rank IS NULL, 0, 1.0 / (60 + fulltext_rank))
  ), 6) AS rrf_score,
  ANY_VALUE(content) AS content
FROM fused
GROUP BY id, project, kind
ORDER BY rrf_score DESC
LIMIT 5;
`.trim();
}

function sqlString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function quoteDatabase(database: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error(`Unsafe SQL identifier: ${database}`);
  }
  return `\`${database}\``;
}
