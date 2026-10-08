import { categoryLabel, entryTitle } from "@/features/i18n/format";
import { useLocale, useTranslations } from "next-intl";
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
  Scale,
  Wallet as WalletIcon,
} from "lucide-react";
import { walletName } from "../../derive";
import { format } from "../../format";
import { receivedAfterFee } from "../../transfer";
import type { Entry, Ledger } from "../../ledger";
import { transactionPage } from "../../pagination";
import { TransactionPagination } from "./transaction-pagination";
import { ReceiptImageDialog } from "@/features/receipts/components/receipt-image-dialog";

export function TransactionsTab({
  data,
  entries,
  periodLabel,
  onEditEntry,
  onAddWallet,
  page,
  timeZone,
}: {
  data: Ledger;
  entries: Entry[];
  periodLabel: string;
  onEditEntry: (entry: Entry) => void;
  onAddWallet: () => void;
  page: unknown;
  timeZone: string;
}) {
  const locale = useLocale();
  const t = useTranslations("UI");
  const pagination = transactionPage(entries, page);
  return (
    <Card className="panel">
      <div className="panel-heading">
        <h3>
          {t("transactionHistory")}{" "}
          <Badge variant="secondary">{entries.length}</Badge>
        </h3>
        <span>{periodLabel}</span>
      </div>
      {!data.wallets.length ? (
        <Empty className="empty">
          <WalletIcon />
          <h3>{t("startWithYourFirstWallet")}</h3>
          <Button onClick={onAddWallet}>
            <Plus size={16} />
            {t("createAWallet")}
          </Button>
        </Empty>
      ) : !entries.length ? (
        <Empty className="empty">
          <List />
          <h3>{t("noTransactionsMatchThisPeriodAndFilters")}</h3>
        </Empty>
      ) : (
        <div className="table-wrap">
          <Table role="table" aria-label={t("transactionHistory")}>
            <TableHeader role="rowgroup">
              <TableRow role="row">
                <TableHead role="columnheader" scope="col">
                  {t("transaction")}
                </TableHead>
                <TableHead role="columnheader" scope="col">
                  {t("dateTime")}
                </TableHead>
                <TableHead role="columnheader" scope="col">
                  {t("wallet")}
                </TableHead>
                <TableHead role="columnheader" scope="col">
                  {t("amount")}
                </TableHead>
                <TableHead role="columnheader" scope="col">
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody role="rowgroup">
              {pagination.rows.map((e) => (
                <TableRow role="row" key={e.id}>
                  <TableCell role="cell" className="transaction-detail">
                    <div className="transaction-name">
                      <Badge
                        variant="secondary"
                        className={`entry-icon ${e.kind}`}
                        aria-label={t(e.kind)}
                      >
                        {e.kind === "transfer" ? (
                          <ArrowLeftRight size={18} />
                        ) : e.kind === "correction" ? (
                          <Scale size={18} />
                        ) : e.kind === "income" ? (
                          <ArrowDownLeft size={18} />
                        ) : (
                          <ArrowUpRight size={18} />
                        )}
                      </Badge>
                      <span>
                        <strong>{entryTitle(e, t)}</strong>
                        <small className="transaction-mobile-date">
                          {new Date(e.date).toLocaleDateString(locale, {
                            timeZone,
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {" · "}
                          {new Date(e.date).toLocaleTimeString(locale, {
                            timeZone,
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                        <small className="transaction-metadata">
                          {categoryLabel(data, e.category, t) ||
                            (e.kind === "correction"
                              ? t("balanceCorrection")
                              : t("transfer"))}
                          <span className="transaction-mobile-wallet">
                            {" · "}
                            {walletName(data, e.wallet)}
                          </span>
                          <span className="transaction-desktop-notes">
                            {e.description && ` · ${e.description}`}
                            {e.transferId && t("linkedToTransfer")}
                            {e.receipt &&
                              t("linkedReceipt") + (e.receipt.keepItems ? t("receiptItemCount", { count: e.receipt.items.length }) : "")}
                            {e.exchangeRate &&
                              ` · 1 ${e.currency} = ${e.exchangeRate.value} ${e.toCurrency}`}
                          </span>
                        </small>
                        {e.kind === "transfer" && (
                          <small className="transaction-mobile-transfer">
                            → {walletName(data, e.toWallet)} ·{" "}
                            {format(receivedAfterFee(data, e), e.toCurrency!, locale)}{" "}
                            {t("received")}
                          </small>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell role="cell" className="transaction-date">
                    {new Date(e.date).toLocaleDateString(locale, { timeZone })}
                    <small>
                      {new Date(e.date).toLocaleTimeString(locale, {
                        timeZone,
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
                        {format(receivedAfterFee(data, e), e.toCurrency!, locale)}{" "}
                        {t("received")}
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
                    {format(e.amount, e.currency, locale)}
                  </TableCell>
                  <TableCell role="cell" className="transaction-actions">
                    {e.receipt?.imageId && <ReceiptImageDialog entry={e} />}
                    {e.kind !== "correction" && (
                      <Button
                        variant="ghost"
                        className="text-button"
                        aria-label={t("editNamedEntry", { title: entryTitle(e, t) })}
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
                        {t("edit")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {entries.length > 0 && <TransactionPagination {...pagination} />}
    </Card>
  );
}
