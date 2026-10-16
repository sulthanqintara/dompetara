import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchLedger, saveLedger, type LedgerState } from "./api";
import { updateLedgerCache } from "./update-ledger-cache";

export function useLedger(initialState: LedgerState) {
  const client = useQueryClient();
  const [state, setState] = useState(initialState);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [notice, setNotice] = useState("");
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => saveLedger(payload, state.version),
    onSuccess: async (saved) => {
      await client.cancelQueries({ queryKey: ["ledger"] });
      setState(saved);
      updateLedgerCache(client, saved);
    },
  });

  async function reload() {
    if (pending) return;
    setPending(true);
    setReloading(true);
    try {
      setState(await fetchLedger());
      await client.cancelQueries({ queryKey: ["ledger"] });
      await client.invalidateQueries({ queryKey: ["ledger"] });
      setRevision((value) => value + 1);
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
      const saved = await mutation.mutateAsync(payload);
      setRevision((value) => value + 1);
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
    version: state.version,
    revision,
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
