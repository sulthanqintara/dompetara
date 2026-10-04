import { Alert } from "@/components/ui/alert";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LedgerSelect } from "@/features/ledger/components/shared/ledger-select";
import { LedgerError } from "@/features/ledger/components/shared/ledger-error";
import { useLedgerContext } from "@/features/ledger/use-ledger-context";
import { money, type Currency, type Entry } from "@/features/ledger/ledger";
import { receiptSchema, validateReceipt, type Extraction } from "../receipts";
import { ConfirmationDialog } from "@/features/ledger/components/shared/confirmation-dialog";
import { localDate } from "@/features/ledger/format";
import { CategoryField } from "@/features/ledger/components/shared/category-field";
import { ReceiptItemRow } from "./receipt-item-row";
import { ReceiptAdjustmentRow } from "./receipt-adjustment-row";

export function ReceiptReview({
  extraction,
  entry,
  close,
}: {
  extraction: Extraction;
  entry?: Entry;
  close: () => void;
}) {
  const {
    data,
    save,
    pending,
    conflict,
    error: ledgerError,
  } = useLedgerContext();
  const [draft, setDraft] = useState(extraction.draft);
  const [keepItems, setKeepItems] = useState(
    entry?.receipt?.keepItems ?? false,
  );
  const [currency, setCurrency] = useState<string>(draft.currency ?? "");
  const [paymentChoice, setPaymentChoice] = useState(
    entry?.receipt?.paymentConfirmed ? "spending" : "unconfirmed",
  );
  const [error, setError] = useState("");
  const wallets = data.wallets.filter((wallet) =>
    wallet.currencies.includes(currency as Currency),
  );
  const suggestedWallet = draft.paymentSource ? wallets.find((wallet) =>
    wallet.id === draft.suggestedWallet?.walletId,
  ) : undefined;
  const categories = data.categories
    .filter((category) => category.kind === "expense")
    .map((category) => ({ value: category.name, label: category.name }));
  if (
    entry &&
    !categories.some((category) => category.value === entry.category)
  )
    categories.unshift({ value: entry.category, label: entry.category });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const receipt = receiptSchema.parse({
        ...extraction,
        documentKind: draft.documentKind,
        merchant: String(values.title),
        receiptNumber: String(values.receiptNumber) || null,
        keepItems,
        paymentConfirmed: paymentChoice === "spending",
        items: keepItems ? draft.items : [],
        adjustments: keepItems ? draft.adjustments : [],
      });
      validateReceipt(receipt, money(String(values.amount), true));
      const date = new Date(`${values.date}T${values.time}`);
      if (!Number.isFinite(date.getTime()))
        throw new Error("Enter a valid date and time.");
      if (
        await save({
          ...values,
          action: entry ? "entry" : "receipt",
          id: entry?.id,
          kind: "expense",
          newCategory: values.newCategory === "true",
          date:
            entry &&
            `${values.date}T${values.time}` ===
              localDate(new Date(entry.date)).slice(0, 16)
              ? entry.date
              : date.toISOString(),
          receipt,
        })
      )
        close();
    } catch (error) {
      setError(
        error instanceof Error && error.name !== "ZodError"
          ? error.message
          : "Check the item names, amounts and quantities.",
      );
    }
  }
  return (
    <form onSubmit={submit}>
      <p>
        Save one expense for the final total. Item details are optional and do
        not change the amount charged to your wallet.
      </p>
      {draft.warnings.map((warning, index) => (
        <Alert key={index} role="status">
          {warning}
        </Alert>
      ))}
      {(!draft.total ||
        !draft.date ||
        !draft.time ||
        !draft.currency ||
        !draft.merchant) && (
        <Alert role="status">
          Some details could not be read. Fill in the missing fields.
        </Alert>
      )}
      {draft.documentKind !== "receipt" && (
        <LedgerSelect
          label="This payment represents"
          value={paymentChoice}
          onValueChange={setPaymentChoice}
          options={[
            {
              value: "unconfirmed",
              label: "Choose after checking the payment",
            },
            { value: "spending", label: "Spending — save as an expense" },
            {
              value: "transfer",
              label: "My own wallets — use Add transaction → Transfer",
            },
          ]}
        />
      )}
      {paymentChoice === "transfer" && (
        <Alert role="status">
          Use Add transaction → Transfer to move money between your own wallets.
        </Alert>
      )}
      <div className="form-field">
        <Label htmlFor="receipt-title">Merchant / title</Label>
        <Input
          id="receipt-title"
          name="title"
          required
          maxLength={1000}
          defaultValue={entry?.title ?? draft.merchant ?? ""}
        />
      </div>
      <div className="form-field">
        <Label htmlFor="receipt-number">Receipt number (optional)</Label>
        <Input
          id="receipt-number"
          name="receiptNumber"
          maxLength={1000}
          defaultValue={draft.receiptNumber ?? ""}
        />
      </div>
      <div className="form-row">
        <div className="form-field">
          <Label htmlFor="receipt-date">Date</Label>
          <Input
            id="receipt-date"
            name="date"
            type="date"
            required
            defaultValue={draft.date ?? ""}
          />
        </div>
        <div className="form-field">
          <Label htmlFor="receipt-time">Time</Label>
          <Input
            id="receipt-time"
            name="time"
            type="time"
            required
            defaultValue={draft.time ?? ""}
          />
        </div>
      </div>
      <LedgerSelect
        label="Currency"
        name="currency"
        required
        value={currency}
        onValueChange={(value) => setCurrency(value as typeof currency)}
        options={["IDR", "USD", "CAD"].map((value) => ({
          value,
          label: value,
        }))}
      />
      {draft.paymentSource && (
        <Alert role="status" className="mb-3 break-words">
          <p>Detected payment source: <strong>{draft.paymentSource}</strong></p>
          <p>{suggestedWallet
            ? `Suggested wallet: ${suggestedWallet.name}. Check or change it before saving.`
            : "Choose the wallet you paid from."}</p>
          {suggestedWallet && <p>{draft.suggestedWallet?.reason}</p>}
        </Alert>
      )}
      <LedgerSelect
        key={currency}
        label="Wallet"
        name="wallet"
        required
        defaultValue={wallets.find((wallet) => wallet.id === entry?.wallet)?.id ?? suggestedWallet?.id}
        options={wallets.map((wallet) => ({
          value: wallet.id,
          label: wallet.name,
        }))}
      />
      <CategoryField
        categories={categories}
        category={entry?.category}
        suggestion={draft.suggestedCategory}
      />
      <div className="form-field">
        <Label htmlFor="receipt-total">Final total</Label>
        <Input
          id="receipt-total"
          name="amount"
          required
          inputMode="decimal"
          defaultValue={draft.total ?? ""}
        />
        <p>
          Use plain amounts, for example 191000. Tax and rounding are included
          in this total.
        </p>
      </div>
      <div className="form-field">
        <Label htmlFor="receipt-description">Note (optional)</Label>
        <Textarea
          id="receipt-description"
          name="description"
          placeholder="For example: a birthday gift for a friend"
          maxLength={1000}
          defaultValue={entry?.description ?? ""}
        />
      </div>
      <LedgerSelect
        label="Save details"
        value={keepItems ? "items" : "total"}
        onValueChange={(value) => setKeepItems(value === "items")}
        options={[
          { value: "total", label: "Total only" },
          { value: "items", label: "Total and individual items" },
        ]}
      />
      {keepItems && (
        <div className="space-y-3">
          {draft.items.map((item, index) => (
            <ReceiptItemRow
              key={index}
              item={item}
              index={index}
              change={(item) =>
                setDraft({
                  ...draft,
                  items: draft.items.map((old, i) =>
                    i === index ? item : old,
                  ),
                })
              }
              remove={() =>
                setDraft({
                  ...draft,
                  items: draft.items.filter((_, i) => i !== index),
                })
              }
            />
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={draft.items.length >= 200}
            onClick={() =>
              setDraft({
                ...draft,
                items: [
                  ...draft.items,
                  {
                    name: "",
                    quantity: null,
                    unitPrice: null,
                    lineTotal: null,
                  },
                ],
              })
            }
          >
            Add item
          </Button>
          {draft.adjustments.map((adjustment, index) => (
            <ReceiptAdjustmentRow
              key={index}
              adjustment={adjustment}
              index={index}
              change={(adjustment) =>
                setDraft({
                  ...draft,
                  adjustments: draft.adjustments.map((old, i) =>
                    i === index ? adjustment : old,
                  ),
                })
              }
              remove={() =>
                setDraft({
                  ...draft,
                  adjustments: draft.adjustments.filter((_, i) => i !== index),
                })
              }
            />
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={draft.adjustments.length >= 30}
            onClick={() =>
              setDraft({
                ...draft,
                adjustments: [...draft.adjustments, { label: "", amount: "0" }],
              })
            }
          >
            Add adjustment
          </Button>
        </div>
      )}
      {error && (
        <Alert variant="destructive" className="error">
          {error}
        </Alert>
      )}
      <LedgerError />
      <div className="form-actions">
        {entry && (
          <ConfirmationDialog
            pending={pending}
            error={ledgerError}
            title="Delete this transaction?"
            description="This deletes the expense and its item details. Wallet balances will be adjusted. This cannot be undone."
            action="Delete transaction"
            trigger={
              <Button type="button" variant="destructive" disabled={pending}>
                Delete
              </Button>
            }
            onConfirm={async () => {
              const ok = await save({ action: "deleteEntry", id: entry.id });
              if (ok) close();
              return ok;
            }}
          />
        )}
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={close}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending || conflict}>
          {pending ? "Saving…" : "Save expense"}
        </Button>
      </div>
    </form>
  );
}
