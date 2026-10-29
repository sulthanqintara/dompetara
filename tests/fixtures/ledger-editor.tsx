import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { EditorForm } from "@/features/ledger/components/editor/editor-form";
import { LedgerStoreContext } from "@/features/ledger/ledger-store-context";
import { createLedgerStore } from "@/features/ledger/ledger-store";
import { QueryClient } from "@tanstack/react-query";
import { RateCacheContext } from "@/features/exchange-rates/rate-cache-context";
import { mutateLedger, emptyLedger, type Ledger } from "@/features/ledger/ledger";
import type { EditorFormProps } from "@/features/ledger/editor";
import { themeCss } from "@/features/branding/design-system";
import en from "../../messages/en.json";
import id from "../../messages/id.json";

type Flags = { pending: boolean; conflict: boolean };
type Config = { type: "entry" | "wallet"; id?: string; wallet?: string; currency?: "IDR" | "USD" | "CAD"; kind?: "income" | "expense" | "transfer" };
declare global {
  interface Window {
    mount: (locale: "en" | "id") => void;
    nextConfig: Config;
    saved: Record<string, unknown>[];
    failSave: boolean;
    setFlags: (flags: Flags) => void;
    currentData: Ledger;
  }
}

const date = "2026-10-01T00:00:56.123Z";
const initial: Ledger = { ...emptyLedger(), wallets: [
  { id: "bank", name: "Fixture Bank", currencies: ["IDR", "USD", "CAD"] },
  { id: "cash", name: "Fixture Cash", currencies: ["IDR", "USD"] },
], entries: [
  { id: "expense", kind: "expense", date, wallet: "bank", currency: "IDR", amount: 1234, title: "Existing lunch", category: "Archived dining", description: "Saved note" },
  { id: "transfer", kind: "transfer", date, wallet: "bank", currency: "USD", amount: 1000, title: "Transfer", category: "", description: "", toWallet: "cash", toCurrency: "IDR", received: 10000, exchangeRate: { value: "10", source: "ecb", referenceDate: "2026-09-30" } },
  { id: "fee", kind: "expense", date, wallet: "cash", currency: "IDR", amount: 50, title: "Transfer service fee", category: "Admin fees", description: "", transferId: "transfer" },
] };
const cache = { get: async () => ({ rate: "2", rateDate: "2026-10-01", provider: "ecb" as const, lastCheckedAt: "2026-10-01T00:00:00Z", stale: false }), clear() {} };

export function LedgerEditorFixture({ locale }: { locale: "en" | "id" }) {
  const [store] = useState(() => createLedgerStore({ initialState: { data: initial, version: 1 }, name: "Fixture", email: "fixture@example.com", initialTimeZone: "Asia/Jakarta", initialMonth: "2026-10" }, new QueryClient(), { fetchLedger: async () => ({ data: initial, version: 1 }), saveLedger: async () => ({ data: initial, version: 2 }) }));
  const [data, setData] = useState(() => structuredClone(initial));
  const [editor, setEditor] = useState<EditorFormProps["editor"]>();
  const [flags, setFlags] = useState<Flags>({ pending: false, conflict: false });
  useEffect(() => { window.setFlags = setFlags; window.currentData = data; }, [data]);
  async function save(payload: Record<string, unknown>) {
    if (window.failSave) throw new Error("Could not save. Please try again.");
    const next = mutateLedger(data, payload);
    window.saved.push(payload);
    setData(next);
    setEditor(undefined);
    return true;
  }
  function open() {
    const config = window.nextConfig;
    if (config.type === "wallet") setEditor({ type: "wallet", wallet: data.wallets.find((wallet) => wallet.id === config.wallet), currency: config.currency });
    else setEditor({ type: "entry", entry: data.entries.find((entry) => entry.id === config.id), kind: config.kind });
  }
  useEffect(() => { store.setState({ data, conflict: flags.conflict, pending: flags.pending }); }, [store, data, flags]);
  return <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : id} timeZone="Asia/Jakarta">
    <style>{themeCss}</style>
    <LedgerStoreContext.Provider value={store}><RateCacheContext.Provider value={cache}>
      <button id="opener" onClick={open}>Open fixture</button>
      {editor && <EditorForm key={JSON.stringify(editor)} editor={editor} data={data}
        kind={editor.type === "entry" ? editor.kind : undefined} restoreFocus={document.getElementById("opener")}
        pending={flags.pending} conflict={flags.conflict} error="" close={() => setEditor(undefined)} save={save} />}
    </RateCacheContext.Provider></LedgerStoreContext.Provider>
  </NextIntlClientProvider>;
}

const root = createRoot(document.getElementById("root")!);
window.mount = (locale) => {
  window.saved = [];
  window.failSave = false;
  root.render(<LedgerEditorFixture key={locale} locale={locale} />);
};
