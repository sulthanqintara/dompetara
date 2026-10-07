import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLedgerContext } from "../../use-ledger-context";

export function BalanceVisibilityToggle() {
  const { balancesVisible, setBalancesVisible } = useLedgerContext();
  const label = balancesVisible ? "Hide amounts" : "Show amounts";
  return (
    <Button variant="ghost" size="icon" className="balance-visibility-toggle"
      aria-label={label} title={label} aria-pressed={balancesVisible}
      onClick={() => setBalancesVisible((visible) => !visible)}>
      {balancesVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </Button>
  );
}
