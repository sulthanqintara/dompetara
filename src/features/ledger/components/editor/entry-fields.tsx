import { categoryLabel } from "@/features/i18n/format";
import { useTranslations } from "next-intl";
import type { Draft } from "@/features/receipts/receipts";
import { TransactionDetails } from "./transaction-details";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  currencies,
  type Currency,
  type Entry,
  type Ledger,
} from "../../ledger";
import { localDate } from "../../format";
import { LedgerSelect } from "../shared/ledger-select";
import { CategoryField } from "../shared/category-field";
import { DateTimeField } from "./date-time-field";
import { TransferFields } from "./transfer-fields";
import { CurrencyInput } from "./currency-input";
import { minorText } from "../../transfer";

export function EntryFields({
  entry,
  data,
  draft,
  kind: selectedKind,
}: {
  entry?: Entry;
  data: Ledger;
  draft?: Draft;
  kind: "income" | "expense" | "transfer";
}) {
  const t = useTranslations("UI");
  const [amount, setAmount] = useState(
    entry ? minorText(entry.amount) : (draft?.total ?? ""),
  );
  const defaultDate = entry
    ? localDate(new Date(entry.date))
    : draft
      ? `${draft.date ?? ""}T${draft.time ?? ""}`
      : localDate(new Date());
  const [rateDate, setRateDate] = useState(defaultDate.split("T")[0]);
  const kind = entry?.kind ?? selectedKind;
  const [cur, setCur] = useState<Currency>(
    entry?.currency ??
      (draft
        ? (draft.currency ?? ("" as Currency))
        : (data.wallets[0]?.currencies[0] ?? "IDR")),
  );
  const [toCur, setToCur] = useState<Currency>(entry?.toCurrency ?? cur);
  const [walletId, setWalletId] = useState(
    entry?.wallet ??
      (draft
        ? (draft.suggestedWallet?.walletId ?? "")
        : (data.wallets.find((w) => w.currencies.includes(cur))?.id ?? "")),
  );
  const [toWalletId, setToWalletId] = useState(entry?.toWallet ?? "");
  const options = currencies.map((c) => ({ value: c, label: c }));
  const categories = data.categories
    .filter((c) => c.kind === kind)
    .map((c) => ({ value: c.name, label: categoryLabel(data, c.name, t) }));
  if (
    entry?.kind === kind &&
    !categories.some((c) => c.value === entry.category)
  )
    categories.unshift({ value: entry.category, label: categoryLabel(data, entry.category, t) });
  return (
    <>
      <input type="hidden" name="kind" value={kind} />
      {draft?.documentKind !== undefined &&
        draft.documentKind !== "receipt" && (
          <LedgerSelect
            label={t("thisPaymentRepresents")}
            name="paymentConfirmed"
            defaultValue={entry?.receipt?.paymentConfirmed ? "true" : "false"}
            options={[
              {
                value: "false",
                label: t("chooseAfterCheckingThePayment"),
              },
              { value: "true", label: t("spendingSaveAsAnExpense") },
              {
                value: "transfer",
                label: t("myOwnWalletsUseAddTransactionTransfer"),
              },
            ]}
          />
        )}
      <DateTimeField
        defaultValue={defaultDate}
        onDateChange={(date) => setRateDate(date.slice(0, 10))}
      />
      <div className="form-row">
        <LedgerSelect
          label={kind === "transfer" ? t("sourceCurrency") : t("currency")}
          name="currency"
          required
          placeholder={t("chooseCurrency")}
          value={cur}
          options={options}
          onValueChange={(value) => {
            const next = value as Currency;
            const nextWallet =
              data.wallets.find((w) => w.currencies.includes(next))?.id ?? "";
            setCur(next);
            setWalletId(nextWallet);
            if (nextWallet === toWalletId && next === toCur) setToWalletId("");
          }}
        />
        <LedgerSelect
          label={kind === "transfer" ? t("fromWallet") : t("wallet")}
          name="wallet"
          required
          value={walletId}
          placeholder={t("chooseWallet")}
          onValueChange={(value) => {
            setWalletId(value);
            if (value === toWalletId && cur === toCur) setToWalletId("");
          }}
          options={data.wallets
            .filter((w) => w.currencies.includes(cur))
            .map((w) => ({ value: w.id, label: w.name }))}
        />
      </div>
      <Label className="form-field">
        {kind === "transfer" ? t("amountSent") : t("amount")}
        <CurrencyInput
          name="amount"
          currency={cur}
          required
          value={amount}
          onValueChange={setAmount}
        />
      </Label>
      {kind === "transfer" ? (
        <>
          <div className="form-row">
            <LedgerSelect
              label={t("destinationCurrency")}
              name="toCurrency"
              value={toCur}
              options={options}
              onValueChange={(value) => {
                setToCur(value as Currency);
                setToWalletId("");
              }}
            />
            <LedgerSelect
              label={t("toWallet")}
              name="toWallet"
              required
              value={toWalletId}
              placeholder={t("chooseWallet")}
              onValueChange={setToWalletId}
              options={data.wallets
                .filter(
                  (w) =>
                    w.currencies.includes(toCur) &&
                    !(w.id === walletId && cur === toCur),
                )
                .map((w) => ({ value: w.id, label: w.name }))}
            />
          </div>
          <TransferFields
            key={`${cur}:${toCur}`}
            entry={
              entry?.currency === cur && entry?.toCurrency === toCur
                ? entry
                : undefined
            }
            data={data}
            currency={cur}
            toCurrency={toCur}
            wallet={walletId}
            toWallet={toWalletId}
            amount={amount}
            date={rateDate}
          />
        </>
      ) : (
        <>
          <Label className="form-field">
            {t("title")}
            <Input
              name="title"
              required
              maxLength={1000}
              defaultValue={entry?.title ?? draft?.merchant ?? ""}
              placeholder={t("eGKaraokean")}
            />
          </Label>
          <CategoryField
            key={kind}
            category={entry?.kind === kind ? entry.category : undefined}
            suggestion={draft?.suggestedCategory}
            categories={categories}
          />
        </>
      )}
      {kind !== "transfer" && (
        <TransactionDetails
          currency={cur}
          amount={amount}
          initial={
            entry?.details ??
            (entry?.receipt
              ? entry.receipt
              : draft
                ? {
                    receiptNumber: draft.receiptNumber,
                    keepItems: false,
                    items: draft.items,
                    adjustments: draft.adjustments,
                  }
                : undefined)
          }
        />
      )}
      <Label className="form-field">
        <span>
          {t("note")} <span className="optional">{t("optional")}
        </span>
        </span>
        <Textarea
          name="description"
          maxLength={1000}
          defaultValue={entry?.description}
          placeholder={t("forExampleABirthdayGiftForAFriend")}
        />
      </Label>
    </>
  );
}
