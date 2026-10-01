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
        <Input
          key={cur}
          type="number"
          step="0.01"
          name="amount"
          required
          defaultValue={wallet ? balance(data, wallet.id, cur) / 100 : 0}
        />
      </Label>
      <p className="hint">
        {wallet
          ? "A balance change adds a correction to your history. Select a new currency to add another balance to this wallet."
          : "You can add more currencies to this wallet later."}
      </p>
    </>
  );
}
