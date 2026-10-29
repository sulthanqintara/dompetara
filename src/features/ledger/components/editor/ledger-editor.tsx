"use client";
import { ReceiptEditor } from "@/features/receipts/components/receipt-editor";
import { useLedgerStore } from "../../use-ledger-store";
import { IncomeModal } from "./income-modal";
import { ExpenseModal } from "./expense-modal";
import { TransferModal } from "./transfer-modal";
import { EditorForm } from "./editor-form";
import { editorIdentity, editorKind } from "../../editor";

const entryModals = { income: IncomeModal, expense: ExpenseModal, transfer: TransferModal, correction: ExpenseModal };

export function LedgerEditor() {
  const editor = useLedgerStore((state) => state.editor);
  const data = useLedgerStore((state) => state.data);
  const pending = useLedgerStore((state) => state.pending);
  const conflict = useLedgerStore((state) => state.conflict);
  const error = useLedgerStore((state) => state.error);
  const setEditor = useLedgerStore((state) => state.setEditor);
  const setError = useLedgerStore((state) => state.setError);
  const save = useLedgerStore((state) => state.save);
  const close = () => {
    setEditor(undefined);
    setError("");
  };
  const saveAndClose = async (payload: Record<string, unknown>) => {
    const ok = await save(payload);
    if (ok) setEditor(undefined);
    return ok;
  };
  if (!editor) return null;
  const receiptEntry = editor.type === "entry" ? editor.entry : undefined;
  if (editor.type === "receipt" || receiptEntry?.receipt)
    return (
      <ReceiptEditor
        entry={receiptEntry}
        restoreFocus={editor.restoreFocus}
      />
    );
  const kind = editorKind(editor);
  const Modal = editor.type === "wallet" ? EditorForm : entryModals[kind ?? "expense"];
  return (
    <Modal
      key={editorIdentity(editor, kind)}
      editor={editor}
      restoreFocus={editor.restoreFocus}
      data={data}
      pending={pending}
      conflict={conflict}
      error={error}
      close={close}
      save={saveAndClose}
    />
  );
}
