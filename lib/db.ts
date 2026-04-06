import postgres from "postgres";

const globalForPostgres = globalThis as typeof globalThis & {
  postgresSql?: ReturnType<typeof postgres>;
};

const sql =
  globalForPostgres.postgresSql ??
  postgres(process.env.DATABASE_URL!, {
    ssl: "require",
    max: 5,
    idle_timeout: 20,
    connect_timeout: 20,
  });

globalForPostgres.postgresSql = sql;

export default sql;
