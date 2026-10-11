"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { useModalHistory } from "@/lib/modal-history/use-modal-history";

export function Sheet(props: SheetPrimitive.Root.Props) {
  const history = useModalHistory(props);
  return <SheetPrimitive.Root data-slot="sheet" {...props} {...history} />;
}
