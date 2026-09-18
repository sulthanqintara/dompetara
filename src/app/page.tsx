import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LedgerApp } from "@/features/ledger/components/ledger-app";
export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return <LedgerApp name={session.user.name} email={session.user.email} />;
}
