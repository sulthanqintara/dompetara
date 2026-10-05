"use client";
import { ReceiptEditor } from "@/features/receipts/components/receipt-editor";
import { useLedgerContext } from "../../use-ledger-context";
import { IncomeModal } from "./income-modal";
import { ExpenseModal } from "./expense-modal";
import { TransferModal } from "./transfer-modal";
import { EditorForm } from "./editor-form";

export function LedgerEditor() {
  const { editor, data, pending, conflict, error, setEditor, setError, save } =
    useLedgerContext();
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
