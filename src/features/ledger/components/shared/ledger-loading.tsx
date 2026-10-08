import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LedgerLoading() {
  return (
    <div data-ledger-loading role="status" aria-label="Loading workspace content" aria-busy="true" className="space-y-4">
      <span className="sr-only">Loading workspace content…</span>
      <div className="grid gap-4 min-[768px]:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <Card key={item} className="min-w-0 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-36 max-w-full" />
          </Card>
        ))}
      </div>
      <Card className="min-w-0 p-5" aria-hidden="true">
        <Skeleton className="h-5 w-40 max-w-full" />
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-11 w-full" />)}
      </Card>
    </div>
  );
}
