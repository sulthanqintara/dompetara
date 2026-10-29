import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTranslations } from "next-intl";

export function TransactionSubmit({ pending }: { pending: boolean }) {
  const t = useTranslations("UI");
  return (
    <Button type="submit" className="relative" disabled={pending} aria-busy={pending} aria-label={t("applyFilters")}>
      <span className={pending ? "invisible" : ""}>{t("applyFilters")}</span>
      {pending && <Spinner className="absolute" />}
    </Button>
  );
}
