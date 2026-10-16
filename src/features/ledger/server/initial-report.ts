import "server-only";
import { redirect } from "next/navigation";
import { readPreferences } from "@/features/i18n/read-preferences";
import { readInitialLedger } from "./read-initial-ledger";
import { readLedgerOverview } from "./read-ledger-overview";
import { initialLedgerQuery } from "./initial-ledger-query";

export async function initialReport() {
  const { session } = await readPreferences();
  if (!session) redirect("/sign-in");
  await readInitialLedger(session.user.id);
  return readLedgerOverview(session.user.id, await initialLedgerQuery({ scope: "report" }));
}
