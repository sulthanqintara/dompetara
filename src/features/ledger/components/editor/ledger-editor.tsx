"use client";
import { ReceiptEditor } from "@/features/receipts/components/receipt-editor";
import { useLedgerStore } from "../../use-ledger-store";
import { IncomeModal } from "./income-modal";
import { ExpenseModal } from "./expense-modal";
import { TransferModal } from "./transfer-modal";
import { EditorForm } from "./editor-form";

export function LedgerEditor() {
  const editor = useLedgerStore((state) => state.editor);
  const data = useLedgerStore((state) => state.data);
  const pending = useLedgerStore((state) => state.pending);
  const conflict = useLedgerStore((state) => state.conflict);
  const error = useLedgerStore((state) => state.error);
  const setEditor = useLedgerStore((state) => state.setEditor);
  const setError = useLedgerStore((state) => state.setError);
  const save = useLedgerStore((state) => state.save);
  if (!editor) return null;
  if (
    editor.type === "receipt" ||
    (editor.type === "entry" && editor.entry?.receipt)
  )
    return (
      <ReceiptEditor
        entry={editor.type === "entry" ? editor.entry : undefined}
        restoreFocus={editor.restoreFocus}
      />
    );
  const kind =
    editor.type === "entry"
      ? (editor.entry?.kind ?? editor.kind ?? "expense")
      : undefined;
  const Modal =
    editor.type === "wallet"
      ? EditorForm
      : kind === "income"
        ? IncomeModal
        : kind === "transfer"
          ? TransferModal
          : ExpenseModal;
  return (
    <Modal
      key={
        editor.type +
        kind +
        (editor.type === "entry" ? editor.entry?.id : editor.wallet?.id) +
        (editor.type === "wallet" ? editor.currency : "")
      }
      editor={editor}
      restoreFocus={editor.restoreFocus}
      data={data}
      pending={pending}
      conflict={conflict}
      error={error}
      close={() => {
        setEditor(undefined);
        setError("");
      }}
      save={async (payload) => {
        const ok = await save(payload);
        if (ok) setEditor(undefined);
        return ok;
      }}
    />
  );
}
