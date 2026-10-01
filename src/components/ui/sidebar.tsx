"use client";
import type { ComponentProps } from "react";
import { cn } from "cn";
import { useSidebar } from "./use-sidebar";
import { Sheet } from "./sheet";
import { SheetContent } from "./sheet-content";
import { SheetTitle } from "./sheet-title";
import { SheetDescription } from "./sheet-description";

// Adapted from shadcn Sidebar; unused variants and icon-rail behavior are omitted.
export function Sidebar({ className, children, ...props }: ComponentProps<"div">) {
  const { isMobile, open, openMobile, setOpenMobile } = useSidebar();
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent side="left" className={cn("ledger-sidebar-sheet", className)}
          id="workspace-navigation" data-mobile="true" aria-modal="true"
          finalFocus={() => document.querySelector<HTMLElement>('[data-sidebar="trigger"]')}
          {...props}>
          <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
          <SheetDescription className="sr-only">Choose a ledger section.</SheetDescription>
          {children}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <div data-slot="sidebar" data-state={open ? "expanded" : "collapsed"} className="ledger-desktop-sidebar">
      <div data-slot="sidebar-gap" />
      <div id="workspace-navigation" data-slot="sidebar-container" className={cn("ledger-sidebar-panel", className)}
        inert={!open} {...props}>
        {children}
      </div>
    </div>
  );
}
