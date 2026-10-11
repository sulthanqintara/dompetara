"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { useModalHistory } from "@/lib/modal-history/use-modal-history";

export function AlertDialog(props: AlertDialogPrimitive.Root.Props) {
  const history = useModalHistory(props);
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} {...history} />;
}
