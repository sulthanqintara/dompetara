import { useTranslations } from "next-intl";
import type { Draft } from "@/features/receipts/receipts";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { currencies, type Entry, type Ledger } from "../../ledger";
import { useEntryFields } from "../../use-entry-fields";
import { LedgerSelect } from "../shared/ledger-select";
import { DateTimeField } from "./date-time-field";
import { CurrencyInput } from "./currency-input";
import { TransactionFields } from "./transaction-fields";
import { TransferDestinationFields } from "./transfer-destination-fields";

export function EntryFields({ entry, data, draft, kind: selectedKind }: {
  entry?: Entry; data: Ledger; draft?: Draft; kind: "income" | "expense" | "transfer";
}) {
  const t = useTranslations("UI");
  const fields = useEntryFields(data, entry, draft);
  const { values } = fields;
  const kind = entry?.kind ?? selectedKind;
  const transfer = kind === "transfer";
  return <>
    <input type="hidden" name="kind" value={kind} />
    <DateTimeField defaultValue={fields.initial.date} onDateChange={fields.setDate} />
    <div className="form-row">
      <LedgerSelect label={transfer ? t("sourceCurrency") : t("currency")} name="currency" required placeholder={t("chooseCurrency")}
        value={values.currency} options={currencies.map((currency) => ({ value: currency, label: currency }))} onValueChange={fields.setCurrency} />
      <LedgerSelect label={transfer ? t("fromWallet") : t("wallet")} name="wallet" required value={values.wallet}
        placeholder={t("chooseWallet")} onValueChange={fields.setWallet}
        options={data.wallets.filter((wallet) => wallet.currencies.includes(values.currency)).map((wallet) => ({ value: wallet.id, label: wallet.name }))} />
    </div>
    <Label className="form-field">{transfer ? t("amountSent") : t("amount")}
      <CurrencyInput name="amount" currency={values.currency} required value={values.amount} onValueChange={fields.setAmount} />
    </Label>
    {transfer
      ? <TransferDestinationFields data={data} entry={entry} values={values} onCurrency={fields.setToCurrency} onWallet={fields.setToWallet} />
      : <TransactionFields data={data} entry={entry} draft={draft} kind={kind} currency={values.currency} amount={values.amount} />}
    <Label className="form-field">
      <span>{t("note")} <span className="optional">{t("optional")}</span></span>
      <Textarea name="description" maxLength={1000} defaultValue={entry?.description} placeholder={t("forExampleABirthdayGiftForAFriend")} />
    </Label>
  </>;
}
