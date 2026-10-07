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
  return (
    <div className="receipt-image-option">
      {!image && (
        <div className="form-field">
          <Label htmlFor="saved-receipt-file">Attach receipt image</Label>
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
          <p>JPEG or PNG, up to 16 MB.</p>
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
            />
            Save receipt image
          </Label>
          <p id="receipt-image-privacy">
            Store a private copy so you can view it later. You can remove it at
            any time.
          </p>
        </>
      )}
    </div>
  );
}
