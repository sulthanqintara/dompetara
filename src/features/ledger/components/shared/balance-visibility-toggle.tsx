import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLedgerStore } from "../../use-ledger-store";

export function BalanceVisibilityToggle() {
  const t = useTranslations("UI");
  const balancesVisible = useLedgerStore((state) => state.balancesVisible);
  const setBalancesVisible = useLedgerStore((state) => state.setBalancesVisible);
  const label = balancesVisible ? t("hideAmounts") : t("showAmounts");
  return (
    <Button variant="ghost" size="icon" className="balance-visibility-toggle"
      aria-label={label} title={label} aria-pressed={balancesVisible}
      onClick={() => setBalancesVisible((visible) => !visible)}>
      {balancesVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </Button>
  );
}
