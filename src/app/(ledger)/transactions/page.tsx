import { TransactionsPage } from "@/features/ledger/components/transactions/transactions-page";
import { initialTransactions } from "@/features/ledger/server/initial-transactions";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const initial = await initialTransactions(await searchParams);
  return <TransactionsPage initial={initial.transactions} initialSummary={initial.summary} />;
}
