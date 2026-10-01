"use client";
import { useLedgerContext } from "../../use-ledger-context";
import { EditorForm } from "./editor-form";

export function LedgerEditor() {
  const { editor, data, pending, error, setEditor, setError, save } = useLedgerContext();
  if (!editor) return null;
  return <EditorForm
    key={editor.type + (editor.type === "entry" ? editor.entry?.id : editor.wallet?.id) + (editor.type === "wallet" ? editor.currency : "")}
    editor={editor} data={data} pending={pending} error={error}
    close={() => { setEditor(undefined); setError(""); }}
    save={async (payload) => { const ok = await save(payload); if (ok) setEditor(undefined); return ok; }}
  />;
}
