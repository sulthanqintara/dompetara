import { SummarySkeleton } from "./summary-skeleton";
import { TransactionsSkeleton } from "./transactions-skeleton";
import { ReportSkeleton } from "./report-skeleton";
import { WalletSkeleton } from "./wallet-skeleton";
import { SettingsSkeleton } from "./settings-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import type { Wallet } from "../../ledger";

export function LedgerLoading({ view = "Transactions", wallets = [] }: { view?: string; wallets?: Wallet[] }) {
  if (view === "Wallet") return <WalletSkeleton wallets={wallets} />;
  if (view === "Settings") return <SettingsSkeleton />;
  return <><Skeleton className="h-11 w-full max-w-96 mb-4" /><SummarySkeleton />
    {view === "Report" ? <ReportSkeleton /> : <><Skeleton className="h-11 w-full my-4" /><TransactionsSkeleton /></>}
  </>;
}
