import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { PaginationContent } from "@/components/ui/pagination-content";
import { PaginationItem } from "@/components/ui/pagination-item";
import { Button } from "@/components/ui/button";
import type { transactionPage } from "../pagination";

export function TransactionPagination({ page, pages, start, end, total }: Omit<ReturnType<typeof transactionPage>, "rows">) {
  return <div className="transaction-pagination">
    <p role="status">Showing {start}–{end} of {total} transactions</p>
    <Pagination aria-label="Transaction history pagination">
      <PaginationContent>
        <PaginationItem><Button variant="outline" size="icon" aria-label="Previous page" disabled={page === 1}
          nativeButton={false} render={<Link href={page <= 2 ? "/transactions" : `/transactions?page=${page - 1}`} scroll={false} />}><ChevronLeft /></Button></PaginationItem>
        <PaginationItem><span aria-current="page">Page {page} of {pages}</span></PaginationItem>
        <PaginationItem><Button variant="outline" size="icon" aria-label="Next page" disabled={page === pages}
          nativeButton={false} render={<Link href={`/transactions?page=${Math.min(pages, page + 1)}`} scroll={false} />}><ChevronRight /></Button></PaginationItem>
      </PaginationContent>
    </Pagination>
  </div>;
}
