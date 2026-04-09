import postgres from "postgres";
import { requireDatabaseUrl } from "@/lib/env";

const globalForPostgres = globalThis as typeof globalThis & {
  postgresSql?: ReturnType<typeof postgres>;
};

const sql =
  globalForPostgres.postgresSql ??
  postgres(requireDatabaseUrl(), {
    ssl: "require",
    max: 5,
    idle_timeout: 20,
    connect_timeout: 20,
  });

globalForPostgres.postgresSql = sql;

export default sql;
