import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Wallet } from "../../ledger";

export function WalletSkeleton({ wallets }: { wallets: Wallet[] }) {
  const t = useTranslations("UI");
  return <div data-ledger-loading role="status" aria-label={t("loadingWorkspaceContent")} aria-busy="true">
    <div className="wallet-visibility-bar" aria-hidden="true"><span>{t("walletBalances")}</span><Skeleton className="size-11" /></div>
    <div className="wallet-grid" aria-hidden="true">{wallets.map((wallet) => <Card className="panel wallet-card" key={wallet.id}>
      <div className="panel-heading"><Skeleton className="h-5 w-28" /><Skeleton className="h-11 w-32" /></div>
      {wallet.currencies.map((currency) => <div className="wallet-balance" key={currency}><span>{currency}</span><Skeleton className="h-5 w-32 max-w-full" /><Skeleton className="size-4" /></div>)}
      {wallet.currencies.some((currency) => currency !== "IDR") && <div className="wallet-balance wallet-total"><span>{t("totalIDR")}</span><Skeleton className="h-5 w-32 max-w-full" /></div>}
    </Card>)}<Skeleton className="add-wallet min-h-32" /></div>
  </div>;
}
