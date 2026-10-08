import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { readPreferences } from "@/features/i18n/read-preferences";
import { LanguagePrompt } from "@/features/i18n/components/language-prompt";
import { readLedger } from "@/features/ledger/read-ledger";
import { localDate } from "@/features/ledger/format";
import { LedgerProvider } from "@/features/ledger/components/layout/ledger-provider";
import { LedgerShell } from "@/features/ledger/components/layout/ledger-shell";
import { randomUUID } from "node:crypto";
import { measureServerStage } from "@/lib/measure-server-stage";

export default async function LedgerLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const context = {
    requestId: randomUUID(), source: "ledger-layout" as const,
    prefetch: requestHeaders.get("next-router-prefetch") === "1",
    rsc: requestHeaders.get("rsc") === "1",
  };
  return measureServerStage(context, "layout.prepare", async () => {
    const { session, preferences } = await measureServerStage(context, "auth.get-session", () => readPreferences());
    if (!session) redirect("/sign-in");
    let timeZone = "UTC";
    try {
      const saved = (await cookies()).get("ledger-timezone")?.value;
      if (saved) { const zone = decodeURIComponent(saved); new Intl.DateTimeFormat("en", { timeZone: zone }); timeZone = zone; }
    } catch { /* An invalid timezone cookie falls back to UTC until hydration. */ }
    return <LedgerProvider initialState={await readLedger(session.user.id, context)} name={session.user.name} email={session.user.email}
      initialTimeZone={timeZone} initialMonth={localDate(new Date(), timeZone).slice(0, 7)}>
      <LedgerShell>{children}</LedgerShell>
      <LanguagePrompt shouldShow={!preferences?.languagePromptShownAt} />
    </LedgerProvider>;
  });
}
