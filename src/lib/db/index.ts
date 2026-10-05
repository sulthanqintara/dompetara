import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalDb = globalThis as typeof globalThis & {
  ledgerSql?: ReturnType<typeof postgres>;
};
const sql =
  globalDb.ledgerSql ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 2,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { application_name: "dompetara" },
  });
if (process.env.NODE_ENV !== "production") globalDb.ledgerSql = sql;

export const db = drizzle(sql, { schema });
