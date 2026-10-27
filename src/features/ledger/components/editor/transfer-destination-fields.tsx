import { useTranslations } from "next-intl";
import type { Entry, Ledger } from "../../ledger";
import { currencies } from "../../ledger";
import { destinationWallets, type EntryFieldValues } from "../../entry-editor";
import { LedgerSelect } from "../shared/ledger-select";
import { TransferFields } from "./transfer-fields";

export function TransferDestinationFields({ data, entry, values, onCurrency, onWallet }: {
  data: Ledger; entry?: Entry; values: EntryFieldValues;
  onCurrency: (currency: string) => void; onWallet: (wallet: string) => void;
}) {
  const t = useTranslations("UI");
  const matchesSavedCurrencies = entry?.currency === values.currency && entry.toCurrency === values.toCurrency;
  return <>
    <div className="form-row">
      <LedgerSelect label={t("destinationCurrency")} name="toCurrency" value={values.toCurrency}
        options={currencies.map((currency) => ({ value: currency, label: currency }))} onValueChange={onCurrency} />
      <LedgerSelect label={t("toWallet")} name="toWallet" required value={values.toWallet} placeholder={t("chooseWallet")}
        onValueChange={onWallet} options={destinationWallets(data, values).map((wallet) => ({ value: wallet.id, label: wallet.name }))} />
    </div>
    <TransferFields key={`${values.currency}:${values.toCurrency}`} entry={matchesSavedCurrencies ? entry : undefined} data={data}
      currency={values.currency} toCurrency={values.toCurrency} wallet={values.wallet} toWallet={values.toWallet}
      amount={values.amount} date={values.date.split("T")[0]} />
  </>;
}
