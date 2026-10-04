import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  balance,
  currencies,
  type Currency,
  type Ledger,
  type Wallet,
} from "../../ledger";
import { CurrencyInput } from "./currency-input";
import { minorText } from "../../transfer";
import { LedgerSelect } from "../shared/ledger-select";

export function WalletFields({
  wallet,
  currency,
  data,
}: {
  wallet?: Wallet;
  currency?: Currency;
  data: Ledger;
}) {
  const [cur, setCur] = useState<Currency>(
    currency ?? wallet?.currencies[0] ?? "IDR",
  );
  const [amounts, setAmounts] = useState<Partial<Record<Currency, string>>>({});
  const amount = amounts[cur] ?? (wallet ? minorText(balance(data, wallet.id, cur)) : "0.00");
  return (
    <>
      <Label className="form-field">
        Wallet name
        <Input
          autoComplete="off"
          name="name"
          required
          maxLength={1000}
          defaultValue={wallet?.name}
          placeholder="e.g. BCA"
        />
      </Label>
      <LedgerSelect
        label="Currency"
        name="currency"
        value={cur}
        onValueChange={(value) => setCur(value as Currency)}
        options={currencies.map((c) => ({ value: c, label: c }))}
      />
      <Label className="form-field">
        {wallet?.currencies.includes(cur)
          ? "Current balance"
          : "Opening balance"}
        <CurrencyInput
          currency={cur}
          name="amount"
          required
          allowNegative
          allowZero
          value={amount}
          onValueChange={(value) => setAmounts((previous) => ({ ...previous, [cur]: value }))}
        />
      </Label>
      {wallet && <p className="hint">Balance changes are recorded as corrections.</p>}
    </>
  );
}
