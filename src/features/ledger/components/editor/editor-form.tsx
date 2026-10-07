import type { Extraction } from "@/features/receipts/receipts";
import {
  transactionDetailsSchema,
  validateTransactionDetails,
} from "@/features/receipts/receipts";
import { ReceiptUpload } from "@/features/receipts/components/receipt-upload";
import { ReceiptPreview } from "@/features/receipts/components/receipt-preview";
import { ReceiptImageOption } from "@/features/receipts/components/receipt-image-option";
import { SavedReceiptImage } from "@/features/receipts/components/saved-receipt-image";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useRef, useState, type FormEvent } from "react";
import { localDate } from "../../format";
import { ReceiptText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DialogContent } from "@/components/ui/dialog-content";
import { EditorHeader } from "./editor-header";
import { EditorBody } from "./editor-body";
import { EditorFooter } from "./editor-footer";
import { LedgerError } from "../shared/ledger-error";
import { Spinner } from "@/components/ui/spinner";
import {
  money,
  type Currency,
  type Entry,
  type Ledger,
  type Wallet,
} from "../../ledger";
import { EntryFields } from "./entry-fields";
import { WalletFields } from "./wallet-fields";
import { ConfirmationDialog } from "../shared/confirmation-dialog";

export type Editor = (
  | { type: "entry"; entry?: Entry; kind?: "income" | "expense" | "transfer" }
  | { type: "receipt" }
  | { type: "wallet"; wallet?: Wallet; currency?: Currency }
) & { restoreFocus?: HTMLElement | null };

export function EditorForm({
  editor,
  kind = "expense",
  extraction: initialExtraction,
  image: initialImage,
  restoreFocus,
  data,
  pending,
  conflict,
  error,
  close,
  save,
}: {
  editor: Exclude<Editor, { type: "receipt" }>;
  kind?: "income" | "expense" | "transfer";
  extraction?: Extraction;
  image?: File;
  restoreFocus?: HTMLElement | null;
  data: Ledger;
  pending: boolean;
  conflict: boolean;
  error: string;
  close: () => void;
  save: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [returnFocus] = useState(
    () => restoreFocus ?? (document.activeElement as HTMLElement | null),
  );
  const importButton = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{
    extraction: Extraction;
    image: File;
  }>();
  const extraction = imported?.extraction ?? initialExtraction;
  const [attachedImage, setAttachedImage] = useState<File>();
  const [keepImage, setKeepImage] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  const image = attachedImage ?? imported?.image ?? initialImage;
  const [formError, setFormError] = useState("");
  const entry = editor.type === "entry" ? editor.entry : undefined;
  const wallet = editor.type === "wallet" ? editor.wallet : undefined;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    setFormError("");
    try {
      const details =
        editor.type === "entry" && values.kind !== "transfer"
          ? transactionDetailsSchema.parse(JSON.parse(String(values.details)))
          : undefined;
      if (details)
        validateTransactionDetails(details, money(String(values.amount), true));
      const receipt = extraction
        ? {
            importId: extraction.importId,
            fingerprint: extraction.fingerprint,
            method: extraction.method,
            documentKind: extraction.draft.documentKind,
            merchant: String(values.title),
            paymentConfirmed:
              values.paymentConfirmed === "true" ||
              entry?.receipt?.paymentConfirmed === true,
            ...details,
          }
        : entry?.receipt
          ? { ...entry.receipt, ...details }
          : undefined;
      const date =
        editor.type === "entry" ? new Date(String(values.date)) : undefined;
      if (date && !Number.isFinite(date.getTime()))
        throw new Error("Enter a valid date and time.");
      await save({
        ...values,
        newCategory: values.newCategory === "true",
        action: extraction && !entry ? "receipt" : editor.type,
        ...(details ? { details: receipt ? undefined : details } : {}),
        ...(receipt ? { receipt } : {}),
        ...(keepImage && image ? { receiptImage: image } : {}),
        ...(removeImage ? { removeReceiptImage: true } : {}),
        id: entry?.id ?? wallet?.id,
        ...(editor.type === "entry"
          ? {
              date:
                entry && String(values.date) === localDate(new Date(entry.date))
                  ? entry.date
                  : new Date(String(values.date)).toISOString(),
            }
          : {}),
      });
    } catch (error) {
      setFormError(
        error instanceof Error && error.name !== "ZodError"
          ? error.message
          : "Check the item names, amounts and quantities.",
      );
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
    >
      <DialogContent
        aria-modal="true"
        className="editor editor-with-body"
        showCloseButton={false}
        finalFocus={() => returnFocus}
      >
        <EditorHeader
          title={
            editor.type === "wallet"
              ? wallet
                ? "Edit wallet"
                : "Add a wallet"
              : extraction && !entry
                ? "Review receipt"
                : `${entry ? "Edit" : "Add"} ${entry?.kind === "correction" ? "opening balance" : kind}`
          }
          close={close}
          pending={pending}
        />
        {editor.type === "entry" &&
          kind === "expense" &&
          !entry &&
          !initialExtraction && (
            <ReceiptUpload
              hidden={!importing}
              onBack={() => {
                setImporting(false);
                requestAnimationFrame(() => importButton.current?.focus());
              }}
              onRead={(extraction, image) => {
                setImported({ extraction, image });
                setFormError("");
                setImporting(false);
                requestAnimationFrame(() =>
                  form.current
                    ?.querySelector<HTMLInputElement>('input[name="title"]')
                    ?.focus(),
                );
              }}
            />
          )}
        <form
          ref={form}
          onSubmit={submit}
          onChange={() => setFormError("")}
          style={importing ? { display: "none" } : undefined}
        >
          <EditorBody>
            {editor.type === "entry" &&
              kind === "expense" &&
              !entry &&
              !extraction && (
                <div className="receipt-import-option">
                  <Button
                    ref={importButton}
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      setImporting(true);
                      requestAnimationFrame(() =>
                        document.getElementById("receipt-image")?.focus(),
                      );
                    }}
                  >
                    <ReceiptText />
                    Import receipt
                  </Button>
                </div>
              )}
            {image && <ReceiptPreview file={image} />}
            {entry?.receipt?.imageId ? <div className="receipt-image-option">
              <SavedReceiptImage imageId={entry.receipt.imageId} />
              <Label htmlFor="remove-saved-receipt-image" className="receipt-image-choice min-h-11 cursor-pointer">
                <Checkbox id="remove-saved-receipt-image" checked={removeImage} onCheckedChange={setRemoveImage} disabled={pending} />Remove saved receipt image
              </Label>
              <p>The image will be removed when you save. Receipt details will be kept.</p>
            </div> : (extraction || entry?.receipt) && <ReceiptImageOption image={image} checked={keepImage} pending={pending} onCheckedChange={setKeepImage} onImageChange={setAttachedImage} />}
            {editor.type === "wallet" ? (
              <WalletFields
                wallet={wallet}
                currency={editor.currency}
                data={data}
              />
            ) : (
              <EntryFields
                key={extraction?.importId ?? "manual"}
                kind={kind}
                entry={entry}
                data={data}
                draft={extraction?.draft}
              />
            )}
            {formError && (
              <Alert variant="destructive" className="error">
                {formError}
              </Alert>
            )}
            <LedgerError />
          </EditorBody>
          <EditorFooter>
            {entry && (
              <ConfirmationDialog
                pending={pending}
                error={error}
                title="Delete this transaction?"
                description={
                  entry.kind === "transfer"
                    ? "This also deletes its linked service fee. Wallet balances will be adjusted. This cannot be undone."
                    : "This cannot be undone. Wallet balances will be adjusted."
                }
                action="Delete transaction"
                trigger={
                  <Button
                    type="button"
                    variant="destructive"
                    className="mr-auto"
                    disabled={pending}
                  >
                    <Trash2 />
                    Delete
                  </Button>
                }
                onConfirm={() => save({ action: "deleteEntry", id: entry.id })}
              />
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={close}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || conflict}>
              {pending && <Spinner />}
              {pending ? "Saving…" : "Save"}
            </Button>
          </EditorFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
