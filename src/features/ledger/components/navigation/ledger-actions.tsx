import { useTranslations } from "next-intl";
import { useRef } from "react";
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ReceiptText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu-trigger";
import { DropdownMenuContent } from "@/components/ui/dropdown-menu-content";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu-item";
import { useLedgerContext } from "../../use-ledger-context";
export function LedgerActions({ tab }: { tab: string }) {
  const t = useTranslations("UI");
  const { data, setEditor, pending, editor } = useLedgerContext();
  const trigger = useRef<HTMLButtonElement>(null);
  if (tab !== "Transactions" && tab !== "Wallet") return null;
  if (tab === "Wallet" || !data.wallets.length)
    return (
      <Button
        ref={trigger}
        className="ledger-add-button"
        aria-label={t("addWallet")}
        disabled={pending}
        onClick={() =>
          setEditor({ type: "wallet", restoreFocus: trigger.current })
        }
      >
        <Plus />
        <span>{t("addWallet")}</span>
      </Button>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            ref={trigger}
            className="ledger-add-button"
            aria-label={t("addTransaction")}
            disabled={pending}
          />
        }
      >
        <Plus />
        <span>{t("addTransaction")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        mobileBackdrop
        className="transaction-action-menu"
        finalFocus={() => (editor ? false : trigger.current)}
      >
        <DropdownMenuItem
          className="transaction-action income"
          onClick={() =>
            setEditor({
              type: "entry",
              restoreFocus: trigger.current,
              kind: "income",
            })
          }
        >
          <ArrowDownLeft />
          {t("income")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="transaction-action expense"
          onClick={() =>
            setEditor({
              type: "entry",
              restoreFocus: trigger.current,
              kind: "expense",
            })
          }
        >
          <ArrowUpRight />
          {t("expense")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="transaction-action transfer"
          onClick={() =>
            setEditor({
              type: "entry",
              restoreFocus: trigger.current,
              kind: "transfer",
            })
          }
        >
          <ArrowLeftRight />
          {t("transfer")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            setEditor({ type: "receipt", restoreFocus: trigger.current })
          }
        >
          <ReceiptText />
          {t("importReceipt")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
