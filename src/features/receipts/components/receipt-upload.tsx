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
}: {
  onRead: (result: Extraction, file: File) => void;
}) {
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
    <form onSubmit={submit} aria-busy={busy}>
      <p>
        Choose how to read your receipt. Review and correct the result before
        saving. Images are sent to Z.ai for reading and are not saved in your
        ledger.
      </p>
      <LedgerSelect
        label="Read with"
        value={method}
        onValueChange={setMethod}
        disabled={busy}
        options={[
          { value: "ocr", label: "OCR — text recognition" },
          { value: "ai", label: "AI — image recognition" },
        ]}
      />
      <div className="form-field">
        <Label htmlFor="receipt-image">Receipt image</Label>
        <Input
          id="receipt-image"
          name="image"
          type="file"
          accept="image/jpeg,image/png"
          required
          disabled={busy}
        />
        <p>JPEG or PNG, up to 16 MB.</p>
      </div>
      {error && (
        <Alert variant="destructive" className="error">
          {error}
        </Alert>
      )}
      <div className="form-actions">
        <Button disabled={busy} type="submit">
          {busy ? "Reading receipt…" : "Read receipt"}
        </Button>
      </div>
    </form>
  );
}
