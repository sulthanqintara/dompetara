import { useState } from "react";
import { saveLedger, type LedgerState } from "./api";

export function useLedger(initialState: LedgerState) {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function save(payload: Record<string, unknown>): Promise<boolean> {
    if (!state || pending) return false;
    setPending(true);
    setError("");
    try {
      setState(await saveLedger(payload, state.version));
      return true;
    } catch (e) {
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
  };
}
