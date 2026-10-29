import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";

export function TransactionSubmit() {
  const t = useTranslations("UI");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="relative" disabled={pending} aria-busy={pending} aria-label={t("applyFilters")}>
      <span className={pending ? "invisible" : ""}>{t("applyFilters")}</span>
      {pending && <Spinner className="absolute" />}
    </Button>
  );
}
