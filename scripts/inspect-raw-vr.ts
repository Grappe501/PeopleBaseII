import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import postgres from "postgres";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL");
  }

  const sql = postgres(databaseUrl, { ssl: "require", max: 1 });
  try {
    const exists = await sql<
      { schema_name: string; object_name: string; relkind: string }[]
    >`
      select n.nspname as schema_name, c.relname as object_name, c.relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'raw_vr'
    `;
    console.log("raw_vr object:", exists);

    const cols = await sql<
      { column_name: string; data_type: string; udt_name: string; is_nullable: string }[]
    >`
      select column_name, data_type, udt_name, is_nullable
      from information_schema.columns
      where table_schema = 'public' and table_name = 'raw_vr'
      order by ordinal_position
    `;
    console.table(cols);

    const idx = await sql<
      { indexname: string; indexdef: string }[]
    >`
      select indexname, indexdef
      from pg_indexes
      where schemaname = 'public' and tablename = 'raw_vr'
      order by indexname
    `;
    console.table(idx);

    const cnt = await sql<{ n: string | number }[]>`
      select count(*)::bigint as n from raw_vr
    `;
    console.log("raw_vr rowcount:", cnt[0]?.n ?? null);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

