"use client";
import { ReceiptEditor } from "@/features/receipts/components/receipt-editor";
import { useLedgerContext } from "../../use-ledger-context";
import { EditorForm } from "./editor-form";

export function LedgerEditor() {
  const { editor, data, pending, conflict, error, setEditor, setError, save } =
    useLedgerContext();
  if (!editor) return null;
  if (editor.type === "entry" && editor.entry?.receipt)
    return <ReceiptEditor entry={editor.entry} />;
  return (
    <EditorForm
      key={
        editor.type +
        (editor.type === "entry" ? editor.entry?.id : editor.wallet?.id) +
        (editor.type === "wallet" ? editor.currency : "")
      }
      editor={editor}
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
