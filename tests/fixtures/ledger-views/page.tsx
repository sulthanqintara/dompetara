import { usePathname } from "next/navigation";
import { TransactionsPage } from "@/features/ledger/components/transactions/transactions-page";
import { ReportPage } from "@/features/ledger/components/reports/report-page";
import { SettingsPage } from "@/features/ledger/components/settings/settings-page";
import { viewInitial, viewSummary } from "./data";

export function LedgerViewsPage() {
  const path = usePathname();
  if (path === "/report") return <ReportPage initial={{ ...viewSummary, query: { ...viewSummary.query, scope: "report" } }} />;
  if (path === "/settings") return <SettingsPage />;
  if (path === "/wallet") return <p>Fixture wallet route</p>;
  if (path === "/sign-in") return <p id="signed-out">Fixture sign-in route</p>;
  return <TransactionsPage initial={viewInitial} initialSummary={viewSummary} />;
}
