import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReceiptFileField({
  disabled,
  onChange,
  onInvalid,
}: {
  disabled: boolean;
  onChange: () => void;
  onInvalid: () => void;
}) {
  const t = useTranslations("UI");
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [filename, setFilename] = useState("");

  return (
    <div className="form-field">
      <Label id="receipt-image-label" htmlFor="receipt-image">
        {t("receiptImage")}
      </Label>
      <Input
        ref={input}
        id="receipt-image"
        name="image"
        type="file"
        accept="image/jpeg,image/png"
        required
        hidden
        disabled={disabled}
        onChange={(event) => {
          setFilename(event.currentTarget.files?.[0]?.name ?? "");
          onChange();
        }}
        onInvalid={(event) => {
          event.preventDefault();
          onInvalid();
          button.current?.focus();
        }}
      />
      <div className="receipt-file-picker">
        <Button
          ref={button}
          id="receipt-file-button"
          type="button"
          variant="outline"
          disabled={disabled}
          aria-describedby="receipt-image-label receipt-file-name receipt-file-hint"
          onClick={() => input.current?.click()}
        >
          <Upload />
          {t("chooseFile")}
        </Button>
        <span id="receipt-file-name" className="receipt-file-name" data-selected={Boolean(filename)} aria-live="polite">
          {filename || t("noFileChosen")}
        </span>
      </div>
      <p id="receipt-file-hint">{t("jPEGOrPNGUpTo16MB")}</p>
    </div>
  );
}
