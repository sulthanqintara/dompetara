"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";

// Adapted from the shadcn Base UI preset.
export function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}
