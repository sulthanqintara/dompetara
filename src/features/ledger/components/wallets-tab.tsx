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
        <article className="panel wallet-card" key={w.id}>
          <div className="panel-heading">
            <h3>
              <WalletIcon size={20} />
              {w.name}
            </h3>
            <button
              className="text-button"
              onClick={() => onEditWallet(w)}
            >
              Edit / add currency
            </button>
          </div>
          {w.currencies.map((c) => (
            <button
              className="wallet-balance"
              key={c}
              onClick={() => onEditWallet(w, c)}
            >
              <span>{c}</span>
              <strong>{format(balance(data, w.id, c), c)}</strong>
              <ChevronRight size={17} />
            </button>
          ))}
          <p className="wallet-footnote">
            Balance edits are recorded as corrections.
          </p>
        </article>
      ))}
      <button className="add-wallet" onClick={() => onEditWallet()}>
        <Plus />
        <strong>Add a wallet</strong>
        <span>Bank account, cash, or e-wallet</span>
      </button>
    </div>
  );
}
