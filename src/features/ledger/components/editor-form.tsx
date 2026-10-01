import { useState, type FormEvent } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DialogContent } from "@/components/ui/dialog-content";
import { DialogTitle } from "@/components/ui/dialog-title";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import type { Currency, Entry, Ledger, Wallet } from "../ledger";
import { EntryFields } from "./entry-fields";
import { WalletFields } from "./wallet-fields";
import { ConfirmationDialog } from "./confirmation-dialog";

export type Editor =
  | { type: "entry"; entry?: Entry }
  | { type: "wallet"; wallet?: Wallet; currency?: Currency };

export function EditorForm({
  editor,
  data,
  pending,
  error,
  close,
  save,
}: {
  editor: Editor;
  data: Ledger;
  pending: boolean;
  error: string;
  close: () => void;
  save: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [returnFocus] = useState(
    () => document.activeElement as HTMLElement | null,
  );
  const entry = editor.type === "entry" ? editor.entry : undefined;
  const wallet = editor.type === "wallet" ? editor.wallet : undefined;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    await save({
      ...values,
      action: editor.type,
      id: entry?.id ?? wallet?.id,
      ...(editor.type === "entry"
        ? { date: new Date(String(values.date)).toISOString() }
        : {}),
    });
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
        className="editor"
        showCloseButton={false}
        finalFocus={() => returnFocus}
      >
        <div className="panel-heading">
          <div>
            <span className="eyebrow">KEEP YOUR LEDGER UP TO DATE</span>
            <DialogTitle>
              {editor.type === "wallet"
                ? wallet
                  ? "Edit wallet"
                  : "Add a wallet"
                : entry
                  ? "Edit transaction"
                  : "Add transaction"}
            </DialogTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={close}
            disabled={pending}
          >
            <X />
          </Button>
        </div>
        <form onSubmit={submit}>
          {editor.type === "wallet" ? (
            <WalletFields
              wallet={wallet}
              currency={editor.currency}
              data={data}
            />
          ) : (
            <EntryFields entry={entry} data={data} />
          )}
          {error && (
            <Alert variant="destructive" className="error">
              {error}
            </Alert>
          )}
          <div className="form-actions">
            {entry && (
              <ConfirmationDialog
                pending={pending}
                error={error}
                title="Delete this transaction?"
                description="This cannot be undone. Wallet balances will be adjusted."
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
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
