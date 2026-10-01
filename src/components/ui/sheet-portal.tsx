"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";

// Adapted from the shadcn Base UI preset.
export function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}
