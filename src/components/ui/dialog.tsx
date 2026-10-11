"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useModalHistory } from "@/lib/modal-history/use-modal-history";

export function Dialog(props: DialogPrimitive.Root.Props) {
  const history = useModalHistory(props);
  return <DialogPrimitive.Root data-slot="dialog" {...props} {...history} />;
}
