import { EditorForm } from "@/features/ledger/components/editor/editor-form";
import { useLedgerContext } from "@/features/ledger/use-ledger-context";
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
  const { data, save, pending, conflict, error } = useLedgerContext();
  return (
    <EditorForm
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
