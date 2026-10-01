"use client";
import { PanelLeft } from "lucide-react";
import { Button } from "./button";
import { useSidebar } from "./use-sidebar";

export function SidebarTrigger({ placement = "header" }: { placement?: "header" | "sidebar" }) {
  const { isMobile, open, openMobile, toggleSidebar } = useSidebar();
  if ((placement === "sidebar") === isMobile) return null;
  const label = isMobile ? "Toggle navigation" : open ? "Collapse sidebar" : "Expand sidebar";
  return (
    <Button data-slot="sidebar-trigger" data-sidebar="trigger" variant="ghost" size="icon"
      aria-label={label} title={label} aria-controls="workspace-navigation"
      aria-expanded={isMobile ? openMobile : open} onClick={toggleSidebar}>
      <PanelLeft />
    </Button>
  );
}
