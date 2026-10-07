import { useRef, useState } from "react";
import { ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DialogContent } from "@/components/ui/dialog-content";
import { EditorHeader } from "@/features/ledger/components/editor/editor-header";
import { EditorBody } from "@/features/ledger/components/editor/editor-body";
import { EditorFooter } from "@/features/ledger/components/editor/editor-footer";
import { ConfirmationDialog } from "@/features/ledger/components/shared/confirmation-dialog";
import { useLedgerContext } from "@/features/ledger/use-ledger-context";
import type { Entry } from "@/features/ledger/ledger";
import { SavedReceiptImage } from "./saved-receipt-image";

export function ReceiptImageDialog({ entry }: { entry: Entry }) {
  const [open, setOpen] = useState(false);
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);
  const fallbackFocus = useRef<HTMLButtonElement | null>(null);
  const { save, pending } = useLedgerContext();
  if (!entry.receipt?.imageId) return null;
  const close = () => setOpen(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="text-button"
        aria-label={`View receipt for ${entry.title}`}
        onClick={(event) => {
          fallbackFocus.current =
            event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
              'button[aria-label^="Edit "]',
            ) ?? null;
          setReturnFocus(event.currentTarget);
          setOpen(true);
        }}
      >
        <ReceiptText size={16} />
        <span className="sr-only">View receipt</span>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <DialogContent
          className="editor editor-with-body receipt-image-dialog"
          showCloseButton={false}
          finalFocus={() =>
            returnFocus?.isConnected ? returnFocus : fallbackFocus.current
          }
        >
          <EditorHeader
            title="Receipt image"
            eyebrow=""
            close={close}
            pending={pending}
          />
          <EditorBody>
            <p className="receipt-image-title">{entry.title}</p>
            <SavedReceiptImage
              key={entry.receipt.imageId}
              imageId={entry.receipt.imageId}
              expandable
            />
          </EditorBody>
          <EditorFooter>
            <ConfirmationDialog
              title="Remove this receipt image?"
              description="The transaction and its receipt details will be kept. This cannot be undone."
              action="Remove image"
              pending={pending}
              trigger={
                <Button type="button" variant="destructive" disabled={pending}>
                  Remove image
                </Button>
              }
              onConfirm={async () => {
                const target = fallbackFocus.current;
                const ok = await save({
                  action: "removeReceiptImage",
                  id: entry.id,
                });
                if (ok) {
                  close();
                  // The image action disappears after removal; keep keyboard
                  // users on the same transaction instead of losing focus.
                  requestAnimationFrame(() => target?.focus());
                }
                return ok;
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={close}
              disabled={pending}
            >
              Close
            </Button>
          </EditorFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
