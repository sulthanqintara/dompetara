"use client";
import { useLedgerContext } from "../../use-ledger-context";
import { WalletsTab } from "./wallets-tab";

export function WalletPage() {
  const { data, setEditor } = useLedgerContext();
  return <WalletsTab data={data} onEditWallet={(wallet, currency) => setEditor({ type: "wallet", wallet, currency })} />;
}
