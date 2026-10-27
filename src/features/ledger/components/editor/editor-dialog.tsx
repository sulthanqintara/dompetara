import { useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { useErrorMessage } from "@/features/i18n/use-error-message";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { DialogContent } from "@/components/ui/dialog-content";
import type { EditorFormProps } from "../../editor";
import type { Entry } from "../../ledger";
import { EditorHeader } from "./editor-header";
import { EditorBody } from "./editor-body";
import { EditorActions } from "./editor-actions";
import { LedgerError } from "../shared/ledger-error";

export function EditorDialog({ title, restoreFocus, pending, conflict, error, close, save, entry, children, beforeForm, hidden, formRef, formError, clearError, submit }: {
  title: string; entry?: Entry; children: ReactNode; beforeForm?: ReactNode; hidden?: boolean;
  formRef?: RefObject<HTMLFormElement | null>; formError: string; clearError: () => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
} & Pick<EditorFormProps, "restoreFocus" | "pending" | "conflict" | "error" | "close" | "save">) {
  const errorMessage = useErrorMessage();
  const [returnFocus] = useState(() => restoreFocus ?? (document.activeElement as HTMLElement | null));
  return <Dialog open onOpenChange={(open) => { if (!open && !pending) close(); }}>
    <DialogContent aria-modal="true" className="editor editor-with-body" showCloseButton={false} finalFocus={() => returnFocus}>
      <EditorHeader title={title} close={close} pending={pending} />
      {beforeForm}
      <form ref={formRef} onSubmit={submit} onChange={clearError} style={hidden ? { display: "none" } : undefined}>
        <EditorBody>
          {children}
          {formError && <Alert variant="destructive" className="error">{errorMessage(formError)}</Alert>}
          <LedgerError />
        </EditorBody>
        <EditorActions entry={entry} pending={pending} conflict={conflict} error={error} close={close} save={save} />
      </form>
    </DialogContent>
  </Dialog>;
}
