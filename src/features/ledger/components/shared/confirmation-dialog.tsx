import { LedgerError } from "./ledger-error";
import { useLedgerContext } from "../../use-ledger-context";
import { useState, type ReactElement } from "react";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog-trigger";
import { AlertDialogContent } from "@/components/ui/alert-dialog-content";
import { AlertDialogTitle } from "@/components/ui/alert-dialog-title";
import { AlertDialogDescription } from "@/components/ui/alert-dialog-description";
import { AlertDialogFooter } from "@/components/ui/alert-dialog-footer";
import { AlertDialogCancel } from "@/components/ui/alert-dialog-cancel";
import { AlertDialogAction } from "@/components/ui/alert-dialog-action";

export function ConfirmationDialog({
  trigger,
  title,
  description,
  action,
  pending,
  onConfirm,
}: {
  trigger: ReactElement;
  title: string;
  description: string;
  action: string;
  pending: boolean;
  error?: string;
  onConfirm: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const { conflict } = useLedgerContext();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent aria-modal="true">
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <LedgerError />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending || conflict}
            onClick={async () => {
              if (await onConfirm()) setOpen(false);
            }}
          >
            {pending ? "Removing…" : action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
