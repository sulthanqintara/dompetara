import { TransactionsPage } from "@/features/ledger/components/transactions/transactions-page";

export default async function Page({ searchParams }: PageProps<"/transactions">) {
  return <TransactionsPage page={(await searchParams).page} />;
}
