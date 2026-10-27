import type { Extraction } from "../receipts/receipts.ts";
import type { Currency, Entry, Ledger, Wallet } from "./ledger-model.ts";

export type Editor = (
  | { type: "entry"; entry?: Entry; kind?: "income" | "expense" | "transfer" }
  | { type: "receipt" }
  | { type: "wallet"; wallet?: Wallet; currency?: Currency }
) & { restoreFocus?: HTMLElement | null; relatedEntries?: Entry[] };

export type EditorFormProps = {
  editor: Exclude<Editor, { type: "receipt" }>;
  kind?: "income" | "expense" | "transfer";
  extraction?: Extraction;
  image?: File;
  restoreFocus?: HTMLElement | null;
  data: Ledger;
  pending: boolean;
  conflict: boolean;
  error: string;
  close: () => void;
  save: (payload: Record<string, unknown>) => Promise<boolean>;
};
