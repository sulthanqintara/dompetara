import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs } from "@/components/ui/tabs";
import { TabsList } from "@/components/ui/tabs-list";
import { TabsTrigger } from "@/components/ui/tabs-trigger";
import { TabsContent } from "@/components/ui/tabs-content";
import { currencies, type Currency, type Entry, type Ledger } from "../ledger";
import { localDate } from "../format";
import { LedgerSelect } from "./ledger-select";
import { DateTimeField } from "./date-time-field";

export function EntryFields({ entry, data }: { entry?: Entry; data: Ledger }) {
  const receivedId = useId();
  const [kind, setKind] = useState(entry?.kind ?? "expense");
  const [cur, setCur] = useState<Currency>(
    entry?.currency ?? data.wallets[0]?.currencies[0] ?? "IDR",
  );
  const [toCur, setToCur] = useState<Currency>(entry?.toCurrency ?? cur);
  const [walletId, setWalletId] = useState(
    entry?.wallet ??
      data.wallets.find((w) => w.currencies.includes(cur))?.id ??
      "",
  );
  const [toWalletId, setToWalletId] = useState(entry?.toWallet ?? "");
  const options = currencies.map((c) => ({ value: c, label: c }));
  const categories = data.categories
    .filter((c) => c.kind === kind)
    .map((c) => ({ value: c.name, label: c.name }));
  if (
    entry?.kind === kind &&
    !categories.some((c) => c.value === entry.category)
  )
    categories.unshift({ value: entry.category, label: entry.category });
  return (
    <>
      <Tabs
        value={kind}
        onValueChange={(value) => setKind(value as Entry["kind"])}
      >
        <TabsList className="segmented" aria-label="Transaction type">
          {["income", "expense", "transfer"].map((k) => (
            <TabsTrigger key={k} value={k}>
              {k}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={kind}>
          <input type="hidden" name="kind" value={kind} />
          <DateTimeField
            defaultValue={localDate(entry ? new Date(entry.date) : new Date())}
          />
          <div className="form-row">
            <LedgerSelect
              label="Currency"
              name="currency"
              value={cur}
              options={options}
              onValueChange={(value) => {
                const next = value as Currency;
                const nextWallet =
                  data.wallets.find((w) => w.currencies.includes(next))?.id ??
                  "";
                setCur(next);
                setWalletId(nextWallet);
                if (nextWallet === toWalletId && next === toCur)
                  setToWalletId("");
              }}
            />
            <LedgerSelect
              label={kind === "transfer" ? "From wallet" : "Wallet"}
              name="wallet"
              required
              value={walletId}
              placeholder="Choose wallet"
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
            {kind === "transfer" ? "Amount sent" : "Amount"}
            <Input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              max="999999999999.99"
              required
              defaultValue={entry ? entry.amount / 100 : ""}
              placeholder="0.00"
            />
          </Label>
          {kind === "transfer" ? (
            <>
              <div className="form-row">
                <LedgerSelect
                  label="Destination currency"
                  name="toCurrency"
                  value={toCur}
                  options={options}
                  onValueChange={(value) => {
                    setToCur(value as Currency);
                    setToWalletId("");
                  }}
                />
                <LedgerSelect
                  label="To wallet"
                  name="toWallet"
                  required
                  value={toWalletId}
                  placeholder="Choose wallet"
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
              {cur !== toCur && (
                <div className="form-field">
                  <Label htmlFor={receivedId}>Amount received ({toCur})</Label>
                  <Input
                    id={receivedId}
                    aria-describedby={`${receivedId}-help`}
                    name="received"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    defaultValue={entry?.received ? entry.received / 100 : ""}
                  />
                  <small id={`${receivedId}-help`}>
                    Enter the actual converted amount credited to the
                    destination.
                  </small>
                </div>
              )}
            </>
          ) : (
            <>
              <Label className="form-field">
                Title
                <Input
                  name="title"
                  required
                  maxLength={1000}
                  defaultValue={entry?.title}
                  placeholder="e.g. Karaokean"
                />
              </Label>
              <LedgerSelect
                key={kind}
                label="Category"
                name="category"
                required
                defaultValue={entry?.kind === kind ? entry.category : undefined}
                placeholder="Choose category"
                options={categories}
              />
              <p className="hint">Manage categories in Settings.</p>
            </>
          )}
          <Label className="form-field">
            Description <span className="optional">optional</span>
            <Textarea
              name="description"
              maxLength={1000}
              defaultValue={entry?.description}
              placeholder="Anything you’d like to remember"
            />
          </Label>
        </TabsContent>
      </Tabs>
    </>
  );
}
