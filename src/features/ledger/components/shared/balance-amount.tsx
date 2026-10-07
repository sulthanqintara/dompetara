import type { ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import { useLedgerContext } from "../../use-ledger-context";

export function BalanceAmount({ children }: { children: ReactNode }) {
  const { balancesVisible } = useLedgerContext();
  return (
    <span className="balance-amount">
      <span className="balance-amount-value" aria-hidden={!balancesVisible}
        style={{ visibility: balancesVisible ? "visible" : "hidden" }}>{children}</span>
      {!balancesVisible && <span className="hidden-balance" role="img" aria-label="Amount hidden">
        <Ellipsis aria-hidden="true" />
      </span>}
    </span>
  );
}
