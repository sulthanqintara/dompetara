"use client";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { DialogContent } from "@/components/ui/dialog-content";
import { EditorHeader } from "@/features/ledger/components/editor/editor-header";
import { useLedgerContext } from "@/features/ledger/use-ledger-context";
import type { Entry } from "@/features/ledger/ledger";
import { localDate } from "@/features/ledger/format";
import type { Extraction } from "../receipts";
import { ReceiptUpload } from "./receipt-upload";
import { ReceiptReview } from "./receipt-review";
export function ReceiptEditor({
  entry,
  restoreFocus,
}: {
  entry?: Entry;
  restoreFocus?: HTMLElement | null;
}) {
  const { pending, setEditor, setError } = useLedgerContext();
  const [image, setImage] = useState<File>();
  const [returnFocus] = useState(
    () => restoreFocus ?? (document.activeElement as HTMLElement | null),
  );
  const [extraction, setExtraction] = useState<Extraction | undefined>(() =>
    entry?.receipt
      ? {
          importId: entry.receipt.importId,
          fingerprint: entry.receipt.fingerprint,
          method: entry.receipt.method,
          draft: {
            documentKind: entry.receipt.documentKind,
            merchant: entry.title,
            date: localDate(new Date(entry.date)).slice(0, 10),
            time: localDate(new Date(entry.date)).slice(11, 16),
            currency: entry.currency,
            receiptNumber: entry.receipt.receiptNumber,
            total: (entry.amount / 100).toFixed(2),
            items: entry.receipt.items,
            adjustments: entry.receipt.adjustments,
            warnings: [],
            suggestedCategory: null,
            paymentSource: null,
            suggestedWallet: null,
          },
        }
      : undefined,
  );
  const close = () => {
    setEditor(undefined);
    setError("");
  };
  if (extraction)
    return (
      <ReceiptReview
        extraction={extraction}
        entry={entry}
        image={image}
        restoreFocus={returnFocus}
        close={close}
      />
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
    >
      <DialogContent
        className="editor editor-with-body"
        aria-modal="true"
        showCloseButton={false}
        finalFocus={() => returnFocus}
      >
        <EditorHeader
          title="Import receipt"
          close={close}
          pending={pending}
          eyebrow=""
        />
        <ReceiptUpload
          onRead={(result, file) => {
            setImage(file);
            setExtraction(result);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
