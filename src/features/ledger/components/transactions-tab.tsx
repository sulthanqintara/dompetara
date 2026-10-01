import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";
import { TableHeader } from "@/components/ui/table-header";
import { TableBody } from "@/components/ui/table-body";
import { TableRow } from "@/components/ui/table-row";
import { TableHead } from "@/components/ui/table-head";
import { TableCell } from "@/components/ui/table-cell";
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
import { receivedAfterFee } from "../transfer";
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
    <Card className="panel">
      <div className="panel-heading">
        <h3>
          Transaction history{" "}
          <Badge variant="secondary">{entries.length}</Badge>
        </h3>
        <span>Selected month · all currencies</span>
      </div>
      {!data.wallets.length ? (
        <Empty className="empty">
          <WalletIcon />
          <h3>Start with your first wallet</h3>
          <p>Add an account and its opening balance to start your ledger.</p>
          <Button onClick={onAddWallet}>
            <Plus size={16} />
            Create a wallet
          </Button>
        </Empty>
      ) : !entries.length ? (
        <Empty className="empty">
          <List />
          <h3>A fresh page for this month</h3>
          <p>Add your first income, expense, or transfer.</p>
        </Empty>
      ) : (
        <div className="table-wrap">
          <Table role="table" aria-label="Transaction history">
            <TableHeader role="rowgroup">
              <TableRow role="row">
                <TableHead role="columnheader" scope="col">
                  Transaction
                </TableHead>
                <TableHead role="columnheader" scope="col">
                  Date & time
                </TableHead>
                <TableHead role="columnheader" scope="col">
                  Wallet
                </TableHead>
                <TableHead role="columnheader" scope="col">
                  Amount
                </TableHead>
                <TableHead role="columnheader" scope="col">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody role="rowgroup">
              {entries.map((e) => (
                <TableRow role="row" key={e.id}>
                  <TableCell role="cell" className="transaction-detail">
                    <div className="transaction-name">
                      <Badge
                        variant="secondary"
                        className={`entry-icon ${e.kind}`}
                        aria-label={e.kind}
                      >
                        {e.kind === "transfer" ? (
                          <ArrowLeftRight size={18} />
                        ) : e.kind === "income" ? (
                          <ArrowDownLeft size={18} />
                        ) : (
                          <ArrowUpRight size={18} />
                        )}
                      </Badge>
                      <span>
                        <strong>{e.title}</strong>
                        <small>
                          {e.category ||
                            (e.kind === "correction"
                              ? "Balance correction"
                              : "Transfer")}
                          {e.description && ` · ${e.description}`}
                          {e.transferId && " · Linked to transfer"}
                          {e.exchangeRate &&
                            ` · 1 ${e.currency} = ${e.exchangeRate.value} ${e.toCurrency}`}
                        </small>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell role="cell" className="transaction-date">
                    {new Date(e.date).toLocaleDateString()}
                    <small>
                      {new Date(e.date).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </TableCell>
                  <TableCell role="cell" className="transaction-wallet">
                    {walletName(data, e.wallet)}
                    {e.kind === "transfer" && (
                      <small>
                        → {walletName(data, e.toWallet)} ·{" "}
                        {format(receivedAfterFee(data, e), e.toCurrency!)}{" "}
                        received
                      </small>
                    )}
                  </TableCell>
                  <TableCell
                    role="cell"
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
                  </TableCell>
                  <TableCell role="cell" className="transaction-actions">
                    {e.kind !== "correction" && (
                      <Button
                        variant="ghost"
                        className="text-button"
                        aria-label={`Edit ${e.title}`}
                        onClick={() =>
                          onEditEntry(
                            e.transferId
                              ? data.entries.find(
                                  (entry) => entry.id === e.transferId,
                                )!
                              : e,
                          )
                        }
                      >
                        Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
