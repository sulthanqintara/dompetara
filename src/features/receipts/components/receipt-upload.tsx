import { useErrorMessage } from "@/features/i18n/use-error-message";
import { useLocale, useTranslations } from "next-intl";
import { EditorBody } from "@/features/ledger/components/editor/editor-body";
import { EditorFooter } from "@/features/ledger/components/editor/editor-footer";
import { Alert } from "@/components/ui/alert";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LedgerSelect } from "@/features/ledger/components/shared/ledger-select";
import { readReceipt } from "../api";
import type { Extraction } from "../receipts";

export function ReceiptUpload({
  onRead,
  onBack,
  hidden = false,
}: {
  onRead: (result: Extraction, file: File) => void;
  onBack?: () => void;
  hidden?: boolean;
}) {
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const t = useTranslations("UI");
  const [method, setMethod] = useState("ocr"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("image");
    if (!(file instanceof File) || !file.size) {
      setError("Choose a receipt image.");
      return;
    }
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      onRead(
        await readReceipt(
          file,
          method as "ocr" | "ai",
          controller.current.signal,
          locale === "id" ? "id" : "en",
        ),
        file,
      );
    } catch (error) {
      if (!controller.current.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Could not read receipt.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      aria-busy={busy}
      style={hidden ? { display: "none" } : undefined}
    >
      <EditorBody>
        <p>{t("receiptImageProcessing")}</p>
        <LedgerSelect
          label={t("readWith")}
          value={method}
          onValueChange={setMethod}
          disabled={busy}
          options={[
            { value: "ocr", label: t("oCRTextRecognition") },
            { value: "ai", label: t("aIImageRecognition") },
          ]}
        />
        <div className="form-field">
          <Label htmlFor="receipt-image">{t("receiptImage")}</Label>
          <Input
            id="receipt-image"
            name="image"
            type="file"
            accept="image/jpeg,image/png"
            required
            disabled={busy}
          />
          <p>{t("jPEGOrPNGUpTo16MB")}</p>
        </div>
        {error && (
          <Alert variant="destructive" className="error">
            {errorMessage(error)}
          </Alert>
        )}
      </EditorBody>
      <EditorFooter>
        {onBack && (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onBack}
          >
            {t("enterManually")}
          </Button>
        )}
        <Button disabled={busy} type="submit">
          {busy ? t("readingReceipt") : t("readReceipt")}
        </Button>
      </EditorFooter>
    </form>
  );
}
