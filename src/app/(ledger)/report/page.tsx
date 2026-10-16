import { ReportPage } from "@/features/ledger/components/reports/report-page";
import { initialReport } from "@/features/ledger/server/initial-report";

export default async function Page() { return <ReportPage initial={await initialReport()} />; }
