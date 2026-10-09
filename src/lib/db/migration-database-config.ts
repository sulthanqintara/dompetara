import { databasePoolConfig } from "./pool-config.ts";

export function migrationDatabaseConfig(connectionString: string | undefined) {
  const config = databasePoolConfig(connectionString);
  if (!config.ssl) return { url: config.connectionString };
  const url = new URL(config.connectionString);
  // Drizzle Kit's pg URL branch ignores a separate ssl option. Explicit
  // connection fields preserve the same trusted CA as the runtime pool.
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ssl: config.ssl,
  };
}
