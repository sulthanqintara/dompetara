import { Suspense } from "react";
import { LedgerBootstrap } from "@/features/ledger/components/layout/ledger-bootstrap";
import { LedgerBootLoading } from "@/features/ledger/components/layout/ledger-boot-loading";

export default function LedgerLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LedgerBootLoading />}><LedgerBootstrap>{children}</LedgerBootstrap></Suspense>;
}
