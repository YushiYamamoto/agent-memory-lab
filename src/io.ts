import fs from "node:fs/promises";
import { z } from "zod";
import type { MemoryRecord } from "./types.js";

const MemoryRecordSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  agent: z.string().min(1),
  project: z.string().min(1),
  kind: z.string().min(1),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().optional(),
});

export async function readJsonl(path: string): Promise<MemoryRecord[]> {
  const raw = await fs.readFile(path, "utf8");
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      const parsed = JSON.parse(line) as unknown;
      const result = MemoryRecordSchema.safeParse(parsed);
      if (!result.success) {
        throw new Error(`Invalid memory record at ${path}:${index + 1}: ${result.error.message}`);
      }
      return result.data;
    });
}
