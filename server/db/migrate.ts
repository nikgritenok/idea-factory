import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export type Sql = ReturnType<typeof postgres>;

export function getSql(url?: string): Sql {
  const databaseUrl =
    url ??
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/idea_factory";
  return postgres(databaseUrl, { max: 5 });
}

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.*\.up\.sql$/.test(f))
    .sort();
}

function readMigration(file: string): string {
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

async function ensureMigrationsTable(sql: Sql): Promise<void> {
  await sql`create table if not exists _migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;
}

export async function migrateUp(sql: Sql, target?: string): Promise<string[]> {
  await ensureMigrationsTable(sql);
  const applied = new Set(
    (await sql`select name from _migrations`).map((r) => r.name as string),
  );
  const appliedNow: string[] = [];
  for (const file of listMigrationFiles()) {
    if (target && file > target) break;
    if (applied.has(file)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readMigration(file));
      await tx`insert into _migrations (name) values (${file})`;
    });
    appliedNow.push(file);
  }
  return appliedNow;
}

export async function migrateDown(sql: Sql, steps = 1): Promise<string[]> {
  await ensureMigrationsTable(sql);
  const appliedRows = await sql`select name from _migrations order by name desc`;
  const reverted: string[] = [];
  for (const row of appliedRows.slice(0, steps)) {
    const name = row.name as string;
    const downFile = name.replace(/\.up\.sql$/, ".down.sql");
    const downPath = join(MIGRATIONS_DIR, downFile);
    const downSql = readFileSync(downPath, "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(downSql);
      await tx`delete from _migrations where name = ${name}`;
    });
    reverted.push(name);
  }
  return reverted;
}

export async function appliedMigrations(sql: Sql): Promise<string[]> {
  await ensureMigrationsTable(sql);
  const rows = await sql`select name from _migrations order by name`;
  return rows.map((r) => r.name as string);
}
