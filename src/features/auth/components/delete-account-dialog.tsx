import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteAccount } from "../api";
import { useErrorMessage } from "@/features/i18n/use-error-message";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog-trigger";
import { AlertDialogContent } from "@/components/ui/alert-dialog-content";
import { AlertDialogTitle } from "@/components/ui/alert-dialog-title";
import { AlertDialogDescription } from "@/components/ui/alert-dialog-description";
import { AlertDialogFooter } from "@/components/ui/alert-dialog-footer";
import { AlertDialogCancel } from "@/components/ui/alert-dialog-cancel";
import { AlertDialogAction } from "@/components/ui/alert-dialog-action";

export function DeleteAccountDialog({ pending, setPending }: {
  pending: boolean;
  setPending: (pending: boolean) => void;
}) {
  const t = useTranslations("UI");
  const errorMessage = useErrorMessage();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  return (
    <AlertDialog open={open} onOpenChange={(next) => {
      if (!pending) {
        setError("");
        setOpen(next);
      }
    }}>
      <AlertDialogTrigger render={<Button variant="destructive" className="min-h-11" disabled={pending} />}>
        {t("deleteAccount")}
      </AlertDialogTrigger>
      <AlertDialogContent aria-modal="true" initialFocus={titleRef}>
        <AlertDialogTitle ref={titleRef} tabIndex={-1}>{t("deleteAccountQuestion")}</AlertDialogTitle>
        <AlertDialogDescription>{t("deleteAccountDescription")}</AlertDialogDescription>
        {error && <Alert variant="destructive" role="alert">{errorMessage(error)}</Alert>}
        <AlertDialogFooter className="min-[480px]:flex-row min-[480px]:justify-end">
          <AlertDialogCancel className="min-h-11" disabled={pending}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" className="min-h-11" disabled={pending} onClick={async () => {
            setError("");
            setPending(true);
            try {
              await deleteAccount();
              window.location.replace("/sign-in");
            } catch (error) {
              setError(error instanceof Error ? error.message : "Could not delete your account. Please try again.");
              setPending(false);
            }
          }}>
            {pending ? t("removing") : t("deleteAccount")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
