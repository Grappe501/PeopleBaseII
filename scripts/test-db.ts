import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import postgres from "postgres";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL");
  }

  const url = new URL(databaseUrl);
  console.log("DATABASE_URL present?", true);
  console.log("host:", url.hostname);
  console.log("port:", url.port);
  console.log("username:", decodeURIComponent(url.username));

  const sql = postgres(databaseUrl, {
    ssl: "require",
    max: 1,
  });

  try {
    const result = await sql`select 1 as ok`;
    console.log("DB OK:", result);
  } catch (error) {
    console.error("DB connection failed:", error);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
