import "server-only";
import { logServerError } from "./log-server-error.ts";

export function logAuthError(level: string, message: string, ...args: unknown[]) {
  if (level !== "error" && level !== "warn") return;
  // Never forward the library's raw query parameters or session objects to console.
  const error = args.find((value) => value instanceof Error);
  logServerError({ provider: "better-auth", stage: "authentication", level, status: 500 }, error ?? new Error(message));
}
