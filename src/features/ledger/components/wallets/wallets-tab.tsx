import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, Plus, Wallet as WalletIcon } from "lucide-react";
import { useCachedRate } from "@/features/exchange-rates/hooks";
import { walletTotalIdr } from "../../derive";
import { format, localDate } from "../../format";
import { balance, type Currency, type Ledger, type Wallet } from "../../ledger";
import { BalanceAmount } from "../shared/balance-amount";

export function WalletsTab({
  data,
  onEditWallet,
}: {
  data: Ledger;
  onEditWallet: (wallet?: Wallet, currency?: Currency) => void;
}) {
  const date = localDate().slice(0, 10);
  const usd = useCachedRate("USD", "IDR", date).suggestion?.rate;
  const cad = useCachedRate("CAD", "IDR", date).suggestion?.rate;
  return (
    <div className="wallet-grid">
      {data.wallets.map((w) => (
        <Card className="panel wallet-card" key={w.id}>
          <div className="panel-heading">
            <h3>
              <WalletIcon size={20} />
              {w.name}
            </h3>
            <Button
              variant="ghost"
              className="text-button"
              onClick={() => onEditWallet(w)}
            >
              Edit / add currency
            </Button>
          </div>
          {w.currencies.map((c) => (
            <Button
              variant="ghost"
              className="wallet-balance"
              key={c}
              onClick={() => onEditWallet(w, c)}
            >
              <span>{c}</span>
              <strong><BalanceAmount currency={c}>{format(balance(data, w.id, c), c)}</BalanceAmount></strong>
              <ChevronRight size={17} />
            </Button>
          ))}
          {w.currencies.some((c) => c !== "IDR") && (() => {
            const { total, partial } = walletTotalIdr(w.currencies.map((c) => ({ currency: c, amount: balance(data, w.id, c) })), { USD: usd, CAD: cad });
            return (
              <div className="wallet-balance wallet-total">
                <span>Total (IDR){partial && " · partial"}</span>
                <strong><BalanceAmount currency="IDR">{format(total, "IDR")}</BalanceAmount></strong>
                <span aria-hidden />
              </div>
            );
          })()}
        </Card>
      ))}
      <Button
        variant="outline"
        className="add-wallet"
        onClick={() => onEditWallet()}
      >
        <Plus />
        <strong>Add a wallet</strong>
      </Button>
    </div>
  );
}
