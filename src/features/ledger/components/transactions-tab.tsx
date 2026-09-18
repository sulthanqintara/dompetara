import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  List,
  Plus,
  Wallet as WalletIcon,
} from "lucide-react";
import { walletName } from "../derive";
import { format } from "../format";
import type { Entry, Ledger } from "../ledger";

export function TransactionsTab({
  data,
  entries,
  onEditEntry,
  onAddWallet,
}: {
  data: Ledger;
  entries: Entry[];
  onEditEntry: (entry: Entry) => void;
  onAddWallet: () => void;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>
          Transaction history <span className="count">{entries.length}</span>
        </h3>
        <span>Selected month · all currencies</span>
      </div>
      {!data.wallets.length ? (
        <div className="empty">
          <WalletIcon />
          <h3>Start with your first wallet</h3>
          <p>
            Add an account and its opening balance to start your ledger.
          </p>
          <button className="primary" onClick={onAddWallet}>
            <Plus size={16} />
            Create a wallet
          </button>
        </div>
      ) : !entries.length ? (
        <div className="empty">
          <List />
          <h3>A fresh page for this month</h3>
          <p>Add your first income, expense, or transfer.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Date & time</th>
                <th>Wallet</th>
                <th>Amount</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="transaction-name">
                      <span className={`entry-icon ${e.kind}`}>
                        {e.kind === "transfer" ? (
                          <ArrowLeftRight size={18} />
                        ) : e.kind === "income" ? (
                          <ArrowDownLeft size={18} />
                        ) : (
                          <ArrowUpRight size={18} />
                        )}
                      </span>
                      <span>
                        <strong>{e.title}</strong>
                        <small>
                          {e.category ||
                            (e.kind === "correction"
                              ? "Balance correction"
                              : "Transfer")}
                          {e.description && ` · ${e.description}`}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>
                    {new Date(e.date).toLocaleDateString()}
                    <small>
                      {new Date(e.date).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </td>
                  <td>
                    {walletName(data, e.wallet)}
                    {e.kind === "transfer" && (
                      <small>
                        → {walletName(data, e.toWallet)} ·{" "}
                        {format(e.received!, e.toCurrency!)}
                      </small>
                    )}
                  </td>
                  <td
                    className={
                      e.kind === "income" ? "positive amount" : "amount"
                    }
                  >
                    {e.kind === "expense" || e.kind === "transfer"
                      ? "−"
                      : e.amount > 0
                        ? "+"
                        : ""}
                    {format(e.amount, e.currency)}
                  </td>
                  <td>
                    {e.kind !== "correction" && (
                      <button
                        className="text-button"
                        onClick={() => onEditEntry(e)}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
