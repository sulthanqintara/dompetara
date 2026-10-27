import { useTranslations } from "next-intl";
import type { EditorFormProps } from "../../editor";
import { walletPayload } from "../../editor-payload";
import { useEditorSubmit } from "../../use-editor-submit";
import { WalletFields } from "./wallet-fields";
import { EditorDialog } from "./editor-dialog";

export function WalletEditorForm({ editor, ...props }: Omit<EditorFormProps, "editor"> & { editor: Extract<EditorFormProps["editor"], { type: "wallet" }> }) {
  const t = useTranslations("UI");
  const { formError, setFormError, submit } = useEditorSubmit((values) => walletPayload(values, editor.wallet), props.save);
  return <EditorDialog {...props} title={t(editor.wallet ? "editWallet" : "addAWallet")} formError={formError} clearError={() => setFormError("")} submit={submit}>
    <WalletFields wallet={editor.wallet} currency={editor.currency} data={props.data} />
  </EditorDialog>;
}
