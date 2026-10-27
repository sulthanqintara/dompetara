import type { EditorFormProps } from "../../editor";
import { WalletEditorForm } from "./wallet-editor-form";
import { EntryEditorForm } from "./entry-editor-form";

export type { Editor } from "../../editor";

export function EditorForm({ editor, ...props }: EditorFormProps) {
  if (editor.type === "wallet") return <WalletEditorForm {...props} editor={editor} />;
  return <EntryEditorForm {...props} editor={editor} />;
}
