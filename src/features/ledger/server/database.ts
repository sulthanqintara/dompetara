import type { db } from "@/lib/db";
export type LedgerDatabase = Pick<typeof db, "select" | "selectDistinct" | "insert" | "update" | "delete" | "execute">;
