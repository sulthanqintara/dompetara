import { TransactionsPage } from "@/features/ledger/components/transactions/transactions-page";

export default async function Page({ searchParams }: PageProps<"/transactions">) {
  return <TransactionsPage searchParams={await searchParams} />;
}
