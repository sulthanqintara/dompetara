import { useState } from "react";
import { fetchLedger, saveLedger, type LedgerState } from "./api";

export function useLedger(initialState: LedgerState) {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [notice, setNotice] = useState("");

  async function reload() {
    if (pending) return;
    setPending(true);
    setReloading(true);
    try {
      setState(await fetchLedger());
      setConflict(false);
      setError("");
      setNotice("Latest ledger loaded. Your unsaved changes are kept.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your ledger. Please try again.");
    } finally {
      setPending(false);
      setReloading(false);
    }
  }

  async function save(payload: Record<string, unknown>): Promise<boolean> {
    if (pending || conflict) return false;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const saved = await saveLedger(payload, state.version);
      setState(saved);
      setNotice(saved.notice ?? "");
      return true;
    } catch (e) {
      if (e instanceof Error && e.cause === 409) setConflict(true);
      setError(
        e instanceof Error ? e.message : "Connection lost. Please try again.",
      );
      return false;
    } finally {
      setPending(false);
    }
  }

  return {
    data: state.data,
    error,
    setError,
    pending,
    setPending,
    save,
    conflict,
    reloading,
    notice,
    reload,
  };
}
