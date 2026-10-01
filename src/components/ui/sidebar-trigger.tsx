"use client";
import { PanelLeft } from "lucide-react";
import { Button } from "./button";
import { useSidebar } from "./use-sidebar";

export function SidebarTrigger() {
  const { isMobile, open, openMobile, toggleSidebar } = useSidebar();
  return (
    <Button data-slot="sidebar-trigger" data-sidebar="trigger" variant="ghost" size="icon"
      aria-label="Toggle navigation" aria-controls="workspace-navigation"
      aria-expanded={isMobile ? openMobile : open} onClick={toggleSidebar}>
      <PanelLeft />
    </Button>
  );
}
