/**
 * Drops all views / materialized views / tables in schema public, then runs sql/001…006.
 * Intended for rebuilding a Supabase dev database in place.
 *
 * Usage:
 *   npx tsx scripts/wipe-public-and-migrate.ts --confirm
 */
import { execSync } from "node:child_process";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import postgres from "postgres";

const root = process.cwd();

dotenv.config({ path: path.join(root, ".env.local"), override: true });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL in .env.local");
}

if (!process.argv.includes("--confirm")) {
  console.error(
    "Refusing to wipe: pass --confirm (this drops all public tables/views).",
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const wipePath = path.join(root, "sql", "000_supabase_drop_public_tables.sql");
  const wipeSql = await fs.readFile(wipePath, "utf8");

  const sql = postgres(databaseUrl, {
    ssl: "require",
    max: 1,
    connect_timeout: 60,
    idle_timeout: 0,
  });

  try {
    console.log("Wiping public schema objects (000_supabase_drop_public_tables.sql)...");
    await sql.unsafe(wipeSql);
    console.log("Wipe complete.");
  } finally {
    await sql.end({ timeout: 10 });
  }

  execSync("npm run db:migrate", { stdio: "inherit", cwd: root });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
