import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Entry } from "../../ledger";
import type { EditorFormProps } from "../../editor";
import { EditorFooter } from "./editor-footer";
import { DeleteEntryAction } from "./delete-entry-action";

export function EditorActions({ entry, pending, conflict, error, close, save }: {
  entry?: Entry;
} & Pick<EditorFormProps, "pending" | "conflict" | "error" | "close" | "save">) {
  const t = useTranslations("UI");
  return <EditorFooter>
    {entry && <DeleteEntryAction entry={entry} pending={pending} error={error} save={save} />}
    <Button type="button" variant="secondary" onClick={close} disabled={pending}>{t("cancel")}</Button>
    <Button type="submit" disabled={pending || conflict}>{pending && <Spinner />}{pending ? t("saving") : t("save")}</Button>
  </EditorFooter>;
}
