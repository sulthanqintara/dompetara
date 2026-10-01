"use client";
import { Tabs } from "@/components/ui/tabs";
import { TabsContent } from "@/components/ui/tabs-content";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { BreadcrumbList } from "@/components/ui/breadcrumb-list";
import { BreadcrumbItem } from "@/components/ui/breadcrumb-item";
import { BreadcrumbSeparator } from "@/components/ui/breadcrumb-separator";
import { BreadcrumbPage } from "@/components/ui/breadcrumb-page";
import { useState } from "react";
import { Plus } from "lucide-react";
import {
  periodEntries,
  periodLabel,
  periodTotals,
  spendByCategory,
  type Period,
} from "../derive";
import { localDate } from "../format";
import { useLedger } from "../hooks";
import { balance, type Currency } from "../ledger";
import { EditorForm, type Editor } from "./editor-form";
import { FiltersBar } from "./filters-bar";
import { ReportTab } from "./report-tab";
import { SettingsTab } from "./settings-tab";
import { Sidebar } from "./sidebar";
import { StatsBar } from "./stats-bar";
import { TransactionsTab } from "./transactions-tab";
import { WalletsTab } from "./wallets-tab";

const tabDescriptions: Record<string, string> = {
  Transactions: "A clear view of what comes in and what goes out.",
  Wallet: "Every account, every currency. Together in one place.",
  Report: "Understand where your money goes.",
  Settings: "Make this ledger your own.",
};

export function LedgerApp({ name, email }: { name: string; email: string }) {
  const { data, error, setError, pending, setPending, save } = useLedger();
  const [tab, setTab] = useState("Transactions");
  const [period, setPeriod] = useState<Period>(() => ({
    month: localDate().slice(0, 7),
  }));
  const [currency, setCurrency] = useState<Currency>("IDR");
  const [editor, setEditor] = useState<Editor>();
  const entries = data ? periodEntries(data, period) : [];
  const { income, expense } = periodTotals(entries, currency);
  const total =
    data?.wallets.reduce((n, w) => n + balance(data, w.id, currency), 0) ?? 0;
  const groups = spendByCategory(entries, currency);
  async function handleSave(payload: Record<string, unknown>) {
    const ok = await save(payload);
    if (ok) setEditor(undefined);
    return ok;
  }
  return (
    <Tabs
      className="app-shell"
      value={tab}
      onValueChange={(value) => setTab(String(value))}
    >
      <Sidebar name={name} tab={tab} />
      <main className="workspace">
        <header className="topbar">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>My workspace</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{tab}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Badge variant="secondary">Private ledger</Badge>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR MONEY, AT A GLANCE</span>
              <h1>{tab}</h1>
              <p>{tabDescriptions[tab]}</p>
            </div>
            {data && tab !== "Settings" && (
              <Button
                onClick={() =>
                  setEditor({
                    type:
                      tab === "Wallet" || !data.wallets.length
                        ? "wallet"
                        : "entry",
                  })
                }
              >
                <Plus size={17} />
                {tab === "Wallet" || !data.wallets.length
                  ? "Add wallet"
                  : "Add transaction"}
              </Button>
            )}
          </div>
          {error && (
            <Alert variant="destructive" className="error">
              {error}{" "}
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Reload ledger
              </Button>
            </Alert>
          )}
          {!data ? (
            <div role="status" aria-live="polite" className="ledger-loading">
              <p>
                {error
                  ? "Your ledger could not be loaded."
                  : "Loading your ledger…"}
              </p>
              {!error && (
                <>
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-64 w-full" />
                </>
              )}
            </div>
          ) : (
            <TabsContent value={tab}>
              {(tab === "Transactions" || tab === "Report") && (
                <>
                  <FiltersBar
                    period={period}
                    currency={currency}
                    onPeriodChange={setPeriod}
                    onCurrencyChange={setCurrency}
                  />
                  <StatsBar
                    income={income}
                    expense={expense}
                    total={total}
                    currency={currency}
                  />
                </>
              )}
              {tab === "Transactions" && (
                <TransactionsTab
                  data={data}
                  entries={entries}
                  periodLabel={periodLabel(period)}
                  onEditEntry={(entry) => setEditor({ type: "entry", entry })}
                  onAddWallet={() => setEditor({ type: "wallet" })}
                />
              )}
              {tab === "Wallet" && (
                <WalletsTab
                  data={data}
                  onEditWallet={(wallet, currency) =>
                    setEditor({ type: "wallet", wallet, currency })
                  }
                />
              )}
              {tab === "Report" && (
                <ReportTab
                  groups={groups}
                  expense={expense}
                  currency={currency}
                  period={period}
                />
              )}
              {tab === "Settings" && (
                <SettingsTab
                  name={name}
                  email={email}
                  error={error}
                  data={data}
                  pending={pending}
                  setPending={setPending}
                  setError={setError}
                  save={handleSave}
                />
              )}
            </TabsContent>
          )}
        </div>
        <footer>
          PERSONAL LEDGER <span>A little clarity goes a long way.</span>
        </footer>
      </main>
      {editor && data && (
        <EditorForm
          key={
            editor.type +
            (editor.type === "entry" ? editor.entry?.id : editor.wallet?.id) +
            (editor.type === "wallet" ? editor.currency : "")
          }
          editor={editor}
          data={data}
          pending={pending}
          error={error}
          close={() => {
            setEditor(undefined);
            setError("");
          }}
          save={handleSave}
        />
      )}
    </Tabs>
  );
}
