import { createStore } from "zustand/vanilla";
import type { QueryClient } from "@tanstack/react-query";
import type { fetchLedger, saveLedger, LedgerState } from "./api.ts";
import { updateLedgerCache } from "./update-ledger-cache.ts";
import type { Currency, Ledger } from "./ledger.ts";
import type { Period } from "./derive.ts";
import type { Editor } from "./components/editor/editor-form";

type Update<T> = T | ((previous: T) => T);
export type LedgerStoreState = {
  data: Ledger; version: number; revision: number;
  name: string; email: string; timeZone: string; period: Period; currency: Currency;
  balancesVisible: boolean; editor: Editor | undefined;
  pending: boolean; conflict: boolean; reloading: boolean; error: string; notice: string;
  setPeriod: (period: Period) => void;
  setCurrency: (update: Update<Currency>) => void;
  setBalancesVisible: (update: Update<boolean>) => void;
  setEditor: (update: Update<Editor | undefined>) => void;
  setPending: (update: Update<boolean>) => void;
  setError: (update: Update<string>) => void;
  setTimeZone: (timeZone: string, defaultMonth: string) => void;
  save: (payload: Record<string, unknown>) => Promise<boolean>;
  reload: () => Promise<void>;
};
export type LedgerStoreInitial = {
  initialState: LedgerState; name: string; email: string; initialTimeZone: string; initialMonth: string;
};

function saveFailureState(error: unknown) {
  if (error instanceof Error) {
    return { error: error.message, ...(error.cause === 409 ? { conflict: true } : {}) };
  }
  return { error: "Connection lost. Please try again." };
}

// Construct inside the account boundary; never share ledger state across requests or accounts.
export function createLedgerStore(initial: LedgerStoreInitial, client: QueryClient,
  api: { fetchLedger: typeof fetchLedger; saveLedger: typeof saveLedger }) {
  let selectedPeriod = false;
  return createStore<LedgerStoreState>()((set, get) => ({
    data: { ...initial.initialState.data, entries: [] }, version: initial.initialState.version, revision: 0,
    name: initial.name, email: initial.email, timeZone: initial.initialTimeZone,
    period: { month: initial.initialMonth }, currency: "IDR", balancesVisible: false, editor: undefined,
    pending: false, conflict: false, reloading: false, error: "", notice: "",
    setPeriod: (period) => { selectedPeriod = true; set({ period }); },
    setCurrency: (update) => set((state) => ({ currency: typeof update === "function" ? update(state.currency) : update })),
    setBalancesVisible: (update) => set((state) => ({ balancesVisible: typeof update === "function" ? update(state.balancesVisible) : update })),
    setEditor: (update) => set((state) => {
      const editor = typeof update === "function" ? update(state.editor) : update;
      return { editor, data: { ...state.data, entries: editor?.relatedEntries ?? [] } };
    }),
    setPending: (update) => set((state) => ({ pending: typeof update === "function" ? update(state.pending) : update })),
    setError: (update) => set((state) => ({ error: typeof update === "function" ? update(state.error) : update })),
    setTimeZone: (timeZone, defaultMonth) => set({ timeZone, ...(!selectedPeriod ? { period: { month: defaultMonth } } : {}) }),
    async save(payload) {
      if (get().pending || get().conflict) return false;
      set({ pending: true, error: "", notice: "" });
      try {
        const saved = await api.saveLedger(payload, get().version);
        await client.cancelQueries({ queryKey: ["ledger"] });
        set((state) => ({ data: { ...saved.data, entries: state.editor?.relatedEntries ?? [] },
          version: saved.version, revision: state.revision + 1, notice: saved.notice ?? "" }));
        updateLedgerCache(client, saved);
        return true;
      } catch (error) {
        set(saveFailureState(error));
        return false;
      } finally {
        set({ pending: false });
      }
    },
    async reload() {
      if (get().pending) return;
      set({ pending: true, reloading: true });
      try {
        const saved = await api.fetchLedger();
        set((state) => ({ data: { ...saved.data, entries: state.editor?.relatedEntries ?? [] }, version: saved.version }));
        await client.cancelQueries({ queryKey: ["ledger"] });
        await client.invalidateQueries({ queryKey: ["ledger"] });
        set((state) => ({ revision: state.revision + 1, conflict: false, error: "",
          notice: "Latest ledger loaded. Your unsaved changes are kept." }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : "Could not load your ledger. Please try again." });
      } finally {
        set({ pending: false, reloading: false });
      }
    },
  }));
}
export type LedgerStore = ReturnType<typeof createLedgerStore>;
