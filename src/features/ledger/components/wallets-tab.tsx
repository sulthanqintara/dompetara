import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, Plus, Wallet as WalletIcon } from "lucide-react";
import { format } from "../format";
import { balance, type Currency, type Ledger, type Wallet } from "../ledger";

export function WalletsTab({
  data,
  onEditWallet,
}: {
  data: Ledger;
  onEditWallet: (wallet?: Wallet, currency?: Currency) => void;
}) {
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
              <strong>{format(balance(data, w.id, c), c)}</strong>
              <ChevronRight size={17} />
            </Button>
          ))}
          <p className="wallet-footnote">
            Balance edits are recorded as corrections.
          </p>
        </Card>
      ))}
      <Button
        variant="outline"
        className="add-wallet"
        onClick={() => onEditWallet()}
      >
        <Plus />
        <strong>Add a wallet</strong>
        <span>Bank account, cash, or e-wallet</span>
      </Button>
    </div>
  );
}
