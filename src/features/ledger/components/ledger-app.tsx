"use client";
import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { monthlyEntries, spendByCategory } from "../derive";
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
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const [currency, setCurrency] = useState<Currency>("IDR");
  const [editor, setEditor] = useState<Editor>();
  const entries = data ? monthlyEntries(data, month) : [];
  const income = entries
    .filter((e) => e.kind === "income" && e.currency === currency)
    .reduce((n, e) => n + e.amount, 0);
  const expense = entries
    .filter((e) => e.kind === "expense" && e.currency === currency)
    .reduce((n, e) => n + e.amount, 0);
  const total =
    data?.wallets.reduce((n, w) => n + balance(data, w.id, currency), 0) ?? 0;
  const groups = data ? spendByCategory(data, month, currency) : [];
  async function handleSave(payload: Record<string, unknown>) {
    const ok = await save(payload);
    if (ok) setEditor(undefined);
    return ok;
  }
  return (
    <div className="app-shell">
      <Sidebar name={name} tab={tab} onTabChange={setTab} />
      <main className="workspace">
        <header className="topbar">
          <span>
            My workspace <ChevronRight size={14} /> <strong>{tab}</strong>
          </span>
          <span className="private-badge">● Private ledger</span>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR MONEY, AT A GLANCE</span>
              <h1>{tab}</h1>
              <p>{tabDescriptions[tab]}</p>
            </div>
            {data && tab !== "Settings" && (
              <button
                className="primary"
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
              </button>
            )}
          </div>
          {error && (
            <div role="alert" className="error">
              {error}{" "}
              <button onClick={() => window.location.reload()}>
                Reload ledger
              </button>
            </div>
          )}
          {!data ? (
            <div className="empty">
              {error
                ? "Your ledger could not be loaded."
                : "Loading your ledger…"}
            </div>
          ) : (
            <>
              {(tab === "Transactions" || tab === "Report") && (
                <>
                  <FiltersBar
                    month={month}
                    currency={currency}
                    onMonthChange={setMonth}
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
                  month={month}
                />
              )}
              {tab === "Settings" && (
                <SettingsTab
                  name={name}
                  email={email}
                  data={data}
                  pending={pending}
                  setPending={setPending}
                  setError={setError}
                  save={handleSave}
                />
              )}
            </>
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
    </div>
  );
}
