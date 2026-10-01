"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";

// Adapted from the shadcn Base UI preset.
export function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}
