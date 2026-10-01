import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { readLedger } from "@/features/ledger/read-ledger";
import { localDate } from "@/features/ledger/format";
import { LedgerProvider } from "@/features/ledger/components/ledger-provider";
import { LedgerShell } from "@/features/ledger/components/ledger-shell";

export default async function LedgerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  let timeZone = "UTC";
  try {
    const saved = (await cookies()).get("ledger-timezone")?.value;
    if (saved) { const zone = decodeURIComponent(saved); new Intl.DateTimeFormat("en", { timeZone: zone }); timeZone = zone; }
  } catch { /* An invalid timezone cookie falls back to UTC until hydration. */ }
  return <LedgerProvider initialState={await readLedger(session.user.id)} name={session.user.name} email={session.user.email}
    initialTimeZone={timeZone} initialMonth={localDate(new Date(), timeZone).slice(0, 7)}>
    <LedgerShell>{children}</LedgerShell>
  </LedgerProvider>;
}
