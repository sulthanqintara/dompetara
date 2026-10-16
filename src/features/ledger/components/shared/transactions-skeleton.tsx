import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table } from "@/components/ui/table";
import { TableHeader } from "@/components/ui/table-header";
import { TableBody } from "@/components/ui/table-body";
import { TableRow } from "@/components/ui/table-row";
import { TableHead } from "@/components/ui/table-head";
import { TableCell } from "@/components/ui/table-cell";

export function TransactionsSkeleton({ rows = 5 }: { rows?: number }) {
  const t = useTranslations("UI");
  return <Card className="panel transactions-skeleton" data-ledger-loading role="status" aria-label={t("loadingWorkspaceContent")} aria-busy="true">
    <div className="panel-heading" aria-hidden="true"><h3>{t("transactionHistory")}</h3><Skeleton className="h-4 w-24" /></div>
    <div className="table-wrap" aria-hidden="true"><Table>
      <TableHeader><TableRow>{["transaction", "dateTime", "wallet", "amount", "actions"].map((label) => <TableHead key={label}>{t(label)}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{Array.from({ length: rows }, (_, index) => <TableRow key={index}>
        <TableCell className="transaction-detail"><div className="transaction-name">
          <Skeleton className="entry-icon size-8 shrink-0" />
          <span><strong><Skeleton className="h-4 w-32 max-w-full" /></strong>
            <small className="transaction-mobile-date"><Skeleton className="h-3 w-20" /></small>
            <small className="transaction-mobile-wallet"><Skeleton className="h-3 w-28 max-w-full" /></small>
          </span>
        </div></TableCell>
        <TableCell className="transaction-date"><Skeleton className="h-4 w-24 max-w-full" /></TableCell>
        <TableCell className="transaction-wallet"><Skeleton className="h-4 w-24 max-w-full" /></TableCell>
        <TableCell className="amount"><Skeleton className="h-4 w-20 max-w-full ml-auto" /></TableCell>
        <TableCell className="transaction-actions"><Skeleton className="size-11 ml-auto" /></TableCell>
      </TableRow>)}</TableBody>
    </Table></div>
  </Card>;
}
