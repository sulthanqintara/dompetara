"use client";
import { useTranslations } from "next-intl";
import { useLedgerStore } from "../../use-ledger-store";
import { WalletsTab } from "./wallets-tab";
import { BalanceVisibilityToggle } from "../shared/balance-visibility-toggle";

export function WalletPage() {
  const t = useTranslations("UI");
  const data = useLedgerStore((state) => state.data);
  const setEditor = useLedgerStore((state) => state.setEditor);
  return <>
    <div className="wallet-visibility-bar"><span>{t("walletBalances")}</span><BalanceVisibilityToggle /></div>
    <WalletsTab data={data} onEditWallet={(wallet, currency) => setEditor({ type: "wallet", wallet, currency })} />
  </>;
}
