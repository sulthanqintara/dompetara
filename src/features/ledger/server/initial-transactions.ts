import "server-only";
import { redirect } from "next/navigation";
import { readPreferences } from "@/features/i18n/read-preferences";
import { initialLedgerQuery } from "./initial-ledger-query";
import { readTransactions } from "./read-transactions";
import { readInitialLedger } from "./read-initial-ledger";
import { readLedgerOverview } from "./read-ledger-overview";

export async function initialTransactions(filters: Record<string, unknown>) {
  const { session } = await readPreferences();
  if (!session) redirect("/sign-in");
  await readInitialLedger(session.user.id);
  const query = await initialLedgerQuery(filters);
  const [transactions, summary] = await Promise.all([
    readTransactions(session.user.id, query), readLedgerOverview(session.user.id, { ...query, scope: "summary" }),
  ]);
  return { transactions, summary };
}
