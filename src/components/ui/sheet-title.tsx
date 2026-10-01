"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";

// Adapted from the shadcn Base UI preset.
export function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "cn-font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}
