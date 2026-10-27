import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Entry } from "../../ledger";
import type { EditorFormProps } from "../../editor";
import { ConfirmationDialog } from "../shared/confirmation-dialog";

export function DeleteEntryAction({ entry, pending, error, save }: {
  entry: Entry;
} & Pick<EditorFormProps, "pending" | "error" | "save">) {
  const t = useTranslations("UI");
  return <ConfirmationDialog pending={pending} error={error} title={t("deleteThisTransaction")}
    description={entry.kind === "transfer"
      ? t("thisAlsoDeletesItsLinkedServiceFeeWalletBalancesWillBeAdjustedThisCannotBeUndone")
      : t("thisCannotBeUndoneWalletBalancesWillBeAdjusted")}
    action={t("deleteTransaction")}
    trigger={<Button type="button" variant="destructive" className="mr-auto" disabled={pending}><Trash2 />{t("delete")}</Button>}
    onConfirm={() => save({ action: "deleteEntry", id: entry.id })} />;
}
