import "server-only";
import { cookies } from "next/headers";
import { localDate } from "../format";
import { ledgerQuery } from "../query";

export async function initialLedgerQuery(filters: Record<string, unknown> = {}) {
  let timeZone = "UTC";
  try {
    const saved = (await cookies()).get("ledger-timezone")?.value;
    if (saved) { const zone = decodeURIComponent(saved); new Intl.DateTimeFormat("en", { timeZone: zone }); timeZone = zone; }
  } catch { /* An invalid cookie falls back to UTC until hydration. */ }
  const month = localDate(new Date(), timeZone).slice(0, 7);
  return ledgerQuery({ month }, timeZone, "IDR", filters);
}
