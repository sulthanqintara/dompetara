import { useTranslations } from "next-intl";
import { ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReceiptUpload } from "@/features/receipts/components/receipt-upload";
import { ReceiptPreview } from "@/features/receipts/components/receipt-preview";
import type { EditorFormProps } from "../../editor";
import { entryPayload } from "../../editor-payload";
import { useEditorSubmit } from "../../use-editor-submit";
import { useEditorReceipt } from "../../use-editor-receipt";
import { EditorDialog } from "./editor-dialog";
import { EntryFields } from "./entry-fields";

export function EntryEditorForm({ editor, kind = "expense", extraction: initialExtraction, image: initialImage, ...props }: Omit<EditorFormProps, "editor"> & { editor: Extract<EditorFormProps["editor"], { type: "entry" }> }) {
  const t = useTranslations("UI");
  const { form: formRef, importButton: importButtonRef, extraction, image, importing, open, back, read } = useEditorReceipt(initialExtraction, initialImage);
  const entry = editor.entry;
  const { formError, setFormError, submit } = useEditorSubmit((values) => entryPayload(values, entry, extraction), props.save);
  const canImport = kind === "expense" && !entry && !initialExtraction;
  const showImportOption = canImport && !extraction;
  const title = extraction && !entry ? t("reviewReceipt") : t(entry ? "editEntry" : "addEntry", { kind: entry?.kind ?? kind });
  return <EditorDialog {...props} title={title} entry={entry} formRef={formRef} formError={formError}
    clearError={() => setFormError("")} submit={submit} hidden={importing}
    beforeForm={canImport && <ReceiptUpload hidden={!importing}
      onBack={back}
      onRead={(extraction, image) => { read(extraction, image); setFormError(""); }} />}>
    {showImportOption && <div className="receipt-import-option">
      <Button ref={importButtonRef} type="button" variant="secondary" disabled={props.pending}
        onClick={open}>
        <ReceiptText />{t("importReceipt")}
      </Button>
    </div>}
    {image && <ReceiptPreview file={image} />}
    <EntryFields key={extraction?.importId ?? "manual"} kind={kind} entry={entry} data={props.data} draft={extraction?.draft} />
  </EditorDialog>;
}
