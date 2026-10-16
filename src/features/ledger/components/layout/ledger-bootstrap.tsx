import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readPreferences } from "@/features/i18n/read-preferences";
import { LanguagePrompt } from "@/features/i18n/components/language-prompt";
import { readInitialLedger } from "@/features/ledger/server/read-initial-ledger";
import { initialLedgerQuery } from "@/features/ledger/server/initial-ledger-query";
import { localDate } from "@/features/ledger/format";
import { LedgerProvider } from "@/features/ledger/components/layout/ledger-provider";
import { LedgerShell } from "@/features/ledger/components/layout/ledger-shell";
import { randomUUID } from "node:crypto";
import { measureServerStage } from "@/lib/measure-server-stage";
import { RequestLimitError } from "@/lib/security/request-limit-error";
import { LedgerRequestLimit } from "@/features/ledger/components/shared/ledger-request-limit";
import { LedgerQueryProvider } from "@/features/ledger/components/layout/ledger-query-provider";

export async function LedgerBootstrap({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const context = {
    requestId: randomUUID(), source: "ledger-layout" as const,
    prefetch: requestHeaders.get("next-router-prefetch") === "1",
    rsc: requestHeaders.get("rsc") === "1",
  };
  return measureServerStage(context, "layout.prepare", async () => {
    const { session, preferences } = await measureServerStage(context, "auth.get-session", () => readPreferences());
    if (!session) redirect("/sign-in");
    const initialQuery = await initialLedgerQuery();
    const timeZone = initialQuery.timeZone;
    let initialState;
    try {
      initialState = await readInitialLedger(session.user.id);
    } catch (error) {
      if (!(error instanceof RequestLimitError)) throw error;
      return <LedgerRequestLimit unavailable={error.status === 503} />;
    }
    return <LedgerQueryProvider key={session.user.id}><LedgerProvider initialState={initialState} name={session.user.name} email={session.user.email}
      initialTimeZone={timeZone} initialMonth={localDate(new Date(), timeZone).slice(0, 7)}>
      <LedgerShell>{children}</LedgerShell>
      <LanguagePrompt shouldShow={!preferences?.languagePromptShownAt} />
    </LedgerProvider></LedgerQueryProvider>;
  });
}
