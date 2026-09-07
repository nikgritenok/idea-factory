import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

let sql: ReturnType<typeof postgres> | null = null;
let migrated = false;

export function db(): ReturnType<typeof postgres> {
  if (!sql) {
    const databaseUrl =
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5432/idea_factory";
    sql = postgres(databaseUrl, { max: 5 });
  }
  return sql;
}

export async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  const { migrateUp } = await import("../db/migrate");
  await migrateUp(db());
  migrated = true;
}
