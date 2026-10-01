"use client";
import { useLedgerContext } from "../../use-ledger-context";
import { SettingsTab } from "./settings-tab";

export function SettingsPage() {
  const { name, email, data, pending, error, setPending, setError, save } = useLedgerContext();
  return <SettingsTab name={name} email={email} data={data} pending={pending} error={error} setPending={setPending} setError={setError} save={save} />;
}
