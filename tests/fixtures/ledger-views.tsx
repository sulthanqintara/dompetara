import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "next-themes";
import { LedgerQueryProvider } from "@/features/ledger/components/layout/ledger-query-provider";
import { LedgerViewsWorkspace } from "./ledger-views/workspace";
import en from "../../messages/en.json";
import id from "../../messages/id.json";

export function LedgerViewsFixture({ locale }: { locale: "en" | "id" }) {
  return <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : id} timeZone="Asia/Jakarta">
    <ThemeProvider attribute="class"><LedgerQueryProvider><LedgerViewsWorkspace /></LedgerQueryProvider></ThemeProvider>
  </NextIntlClientProvider>;
}
const root = createRoot(document.getElementById("root")!);
Object.assign(window, { mountLedgerViews: (locale: "en" | "id") => root.render(<LedgerViewsFixture key={locale} locale={locale} />) });
