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
  const { data, setEditor, pending, editor } = useLedgerContext();
  const trigger = useRef<HTMLButtonElement>(null);
  if (tab !== "Transactions" && tab !== "Wallet") return null;
  if (tab === "Wallet" || !data.wallets.length)
    return (
      <Button
        ref={trigger}
        className="ledger-add-button"
        aria-label="Add wallet"
        disabled={pending}
        onClick={() =>
          setEditor({ type: "wallet", restoreFocus: trigger.current })
        }
      >
        <Plus />
        <span>Add wallet</span>
      </Button>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            ref={trigger}
            className="ledger-add-button"
            aria-label="Add transaction"
            disabled={pending}
          />
        }
      >
        <Plus />
        <span>Add transaction</span>
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
          Income
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
          Expense
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
          Transfer
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            setEditor({ type: "receipt", restoreFocus: trigger.current })
          }
        >
          <ReceiptText />
          Import receipt
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
