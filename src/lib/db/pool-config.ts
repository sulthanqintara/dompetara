import { z } from "zod";
import { supabaseRootCa } from "./supabase-ca.ts";

export function databasePoolConfig(connectionString: string | undefined, vercelRuntime = false) {
  const result = z.string().url().safeParse(connectionString);
  if (!result.success) throw new Error("A valid DATABASE_URL is required.");
  const url = new URL(result.data);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("DATABASE_URL must use the PostgreSQL protocol.");
  if (vercelRuntime && url.hostname.endsWith(".pooler.supabase.com") && url.port !== "6543")
    throw new Error("Vercel requires the Supabase transaction pooler on port 6543.");
  const supabasePooler = url.hostname.endsWith(".pooler.supabase.com");
  // pg parses SSL URL options after Pool options; remove them so they cannot
  // override the trusted CA or disable certificate verification.
  if (supabasePooler) {
    for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) url.searchParams.delete(key);
  }
  return {
    connectionString: supabasePooler ? url.toString() : result.data,
    ...(supabasePooler ? { ssl: { ca: supabaseRootCa, rejectUnauthorized: true } } : {}),
    max: 2,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    application_name: "dompetara",
  };
}
