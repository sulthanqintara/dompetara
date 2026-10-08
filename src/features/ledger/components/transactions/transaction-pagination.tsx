"use client";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { PaginationContent } from "@/components/ui/pagination-content";
import { PaginationItem } from "@/components/ui/pagination-item";
import { Button } from "@/components/ui/button";
import type { transactionPage } from "../../pagination";

export function TransactionPagination({ page, pages, start, end, total }: Omit<ReturnType<typeof transactionPage>, "rows">) {
  const t = useTranslations("UI");
  const searchParams = useSearchParams();
  const pageHref = (value: number) => {
    const params = new URLSearchParams(searchParams);
    if (value === 1) params.delete("page");
    else params.set("page", String(value));
    return `/transactions${params.size ? `?${params}` : ""}`;
  };
  return <div className="transaction-pagination">
    <p role="status">{t("showingTransactions", { start, end, total })}</p>
    <Pagination aria-label={t("transactionHistoryPagination")}>
      <PaginationContent>
        <PaginationItem><Button variant="outline" size="icon" aria-label={t("previousPage")} disabled={page === 1}
          nativeButton={false} render={<Link href={pageHref(page - 1)} scroll={false} />}><ChevronLeft /></Button></PaginationItem>
        <PaginationItem><span aria-current="page">{t("pageOfPages", { page, pages })}</span></PaginationItem>
        <PaginationItem><Button variant="outline" size="icon" aria-label={t("nextPage")} disabled={page === pages}
          nativeButton={false} render={<Link href={pageHref(Math.min(pages, page + 1))} scroll={false} />}><ChevronRight /></Button></PaginationItem>
      </PaginationContent>
    </Pagination>
  </div>;
}
