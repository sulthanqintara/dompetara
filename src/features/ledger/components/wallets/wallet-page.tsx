"use client";
import { useLedgerContext } from "../../use-ledger-context";
import { WalletsTab } from "./wallets-tab";
import { BalanceVisibilityToggle } from "../shared/balance-visibility-toggle";

export function WalletPage() {
  const { data, setEditor } = useLedgerContext();
  return <>
    <div className="wallet-visibility-bar"><span>Wallet balances</span><BalanceVisibilityToggle /></div>
    <WalletsTab data={data} onEditWallet={(wallet, currency) => setEditor({ type: "wallet", wallet, currency })} />
  </>;
}
