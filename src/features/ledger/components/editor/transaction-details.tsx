import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { ReceiptItemRow } from "@/features/receipts/components/receipt-item-row";
import { ReceiptAdjustmentRow } from "@/features/receipts/components/receipt-adjustment-row";
import type { TransactionDetails as Details } from "@/features/receipts/receipts";
import { transactionDetailsDifference } from "@/features/receipts/receipts";
import { format } from "../../format";
import type { Currency } from "../../ledger";
import { LedgerSelect } from "../shared/ledger-select";

export function TransactionDetails({
  initial,
  currency,
  amount,
}: {
  initial?: Details;
  currency: Currency;
  amount: string;
}) {
  const locale = useLocale();
  const t = useTranslations("UI");
  const [details, setDetails] = useState<Details>(
    initial ?? {
      receiptNumber: null,
      keepItems: false,
      items: [],
      adjustments: [],
    },
  );
  const saved = details.keepItems
    ? details
    : { ...details, items: [], adjustments: [] };
  const reconciliation = transactionDetailsDifference(details, amount);
  const addAdjustment = (label: string) =>
    setDetails({
      ...details,
      adjustments: [...details.adjustments, { label, amount: "0.00" }],
    });
  return (
    <div className="transaction-details">
      <input type="hidden" name="details" value={JSON.stringify(saved)} />
      <LedgerSelect
        label={t("saveDetails")}
        value={details.keepItems ? "items" : "total"}
        onValueChange={(value) =>
          setDetails({ ...details, keepItems: value === "items" })
        }
        options={[
          { value: "total", label: t("totalOnly") },
          { value: "items", label: t("totalAndIndividualItems") },
        ]}
      />
      {details.keepItems && (
        <div className="space-y-3">
          <Alert variant={reconciliation && reconciliation.difference !== BigInt(0) ? "destructive" : "default"} role="status">
            {reconciliation ? (
              <>
                <p>{t("itemsAndAdjustments", { amount: format(Number(reconciliation.total), currency, locale) })}</p>
                <p>{reconciliation.difference === BigInt(0)
                  ? t("matchesTheTransactionAmount")
                  : t("receiptDifference", { amount: format(Number(reconciliation.difference), currency, locale) })}</p>
              </>
            ) : <p>{t("enterEveryLineTotalAndAdjustmentToCheckThemAgainstTheTransactionAmount")}</p>}
          </Alert>
          <Label className="form-field">
            {t("receiptNumberOptional")}
            <Input
              value={details.receiptNumber ?? ""}
              maxLength={1000}
              onChange={(event) =>
                setDetails({
                  ...details,
                  receiptNumber: event.target.value || null,
                })
              }
            />
          </Label>
          {details.items.map((item, index) => (
            <ReceiptItemRow
              key={index}
              item={item}
              index={index}
              currency={currency}
              change={(item) =>
                setDetails({
                  ...details,
                  items: details.items.map((old, i) =>
                    i === index ? item : old,
                  ),
                })
              }
              remove={() =>
                setDetails({
                  ...details,
                  items: details.items.filter((_, i) => i !== index),
                })
              }
            />
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={details.items.length >= 200}
            onClick={() =>
              setDetails({
                ...details,
                items: [
                  ...details.items,
                  { name: "", quantity: 1, unitPrice: null, lineTotal: null },
                ],
              })
            }
          >
            {t("addItem")}
          </Button>
          {details.adjustments.map((adjustment, index) => (
            <ReceiptAdjustmentRow
              key={index}
              adjustment={adjustment}
              index={index}
              currency={currency}
              change={(adjustment) =>
                setDetails({
                  ...details,
                  adjustments: details.adjustments.map((old, i) =>
                    i === index ? adjustment : old,
                  ),
                })
              }
              remove={() =>
                setDetails({
                  ...details,
                  adjustments: details.adjustments.filter(
                    (_, i) => i !== index,
                  ),
                })
              }
            />
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={details.adjustments.length >= 30}
              onClick={() => addAdjustment(t("discount"))}
            >
              {t("addDiscount")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={details.adjustments.length >= 30}
              onClick={() => addAdjustment(t("tax"))}
            >
              {t("addTax")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={details.adjustments.length >= 30}
              onClick={() => addAdjustment("")}
            >
              {t("addAdjustment")}
            </Button>
          </div>
          <p className="hint">
            {t("itemsAndAdjustmentsMustEqualTheAmountEnterDiscountsAsNegativeAmountsAddTaxOnlyWhenItIsNotAlreadyIncluded")}
          </p>
        </div>
      )}
    </div>
  );
}
