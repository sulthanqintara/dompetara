"use client";
import { useLedgerStore } from "../../use-ledger-store";
import { SettingsTab } from "./settings-tab";

export function SettingsPage() {
  const name = useLedgerStore((state) => state.name);
  const email = useLedgerStore((state) => state.email);
  const data = useLedgerStore((state) => state.data);
  const pending = useLedgerStore((state) => state.pending);
  const error = useLedgerStore((state) => state.error);
  const setPending = useLedgerStore((state) => state.setPending);
  const setError = useLedgerStore((state) => state.setError);
  const save = useLedgerStore((state) => state.save);
  return <SettingsTab name={name} email={email} data={data} pending={pending} error={error} setPending={setPending} setError={setError} save={save} />;
}
