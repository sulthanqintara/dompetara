import { ExpenseModal } from "@/features/ledger/components/editor/expense-modal";
import { useLedgerStore } from "@/features/ledger/use-ledger-store";
import type { Entry } from "@/features/ledger/ledger";
import type { Extraction } from "../receipts";

export function ReceiptReview({
  extraction,
  entry,
  image,
  restoreFocus,
  close,
}: {
  extraction: Extraction;
  entry?: Entry;
  image?: File;
  restoreFocus?: HTMLElement | null;
  close: () => void;
}) {
  const data = useLedgerStore((state) => state.data);
  const save = useLedgerStore((state) => state.save);
  const pending = useLedgerStore((state) => state.pending);
  const conflict = useLedgerStore((state) => state.conflict);
  const error = useLedgerStore((state) => state.error);
  return (
    <ExpenseModal
      editor={{ type: "entry", entry }}
      extraction={extraction}
      image={image}
      restoreFocus={restoreFocus}
      data={data}
      pending={pending}
      conflict={conflict}
      error={error}
      close={close}
      save={async (payload) => {
        const ok = await save(payload);
        if (ok) close();
        return ok;
      }}
    />
  );
}
