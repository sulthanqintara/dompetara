import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReceiptImageOption({
  image,
  checked,
  pending,
  onCheckedChange,
  onImageChange,
}: {
  image?: File;
  checked: boolean;
  pending: boolean;
  onCheckedChange: (checked: boolean) => void;
  onImageChange: (image?: File) => void;
}) {
  const t = useTranslations("UI");
  return (
    <div className="receipt-image-option">
      {!image && (
        <div className="form-field">
          <Label htmlFor="saved-receipt-file">{t("attachReceiptImage")}</Label>
          <Input
            id="saved-receipt-file"
            type="file"
            accept="image/jpeg,image/png"
            disabled={pending}
            onChange={(event) => {
              onImageChange(event.target.files?.[0]);
              onCheckedChange(false);
            }}
          />
          <p>{t("jPEGOrPNGUpTo16MB")}</p>
        </div>
      )}
      {image && (
        <>
          <Label
            htmlFor="save-receipt-image"
            className="receipt-image-choice min-h-11 cursor-pointer"
          >
            <Checkbox
              id="save-receipt-image"
              checked={checked}
              onCheckedChange={onCheckedChange}
              disabled={pending}
              aria-describedby="receipt-image-privacy"
            />{t("saveReceiptImage")}</Label>
          <p id="receipt-image-privacy">{t("privateReceiptCopy")}</p>
        </>
      )}
    </div>
  );
}
