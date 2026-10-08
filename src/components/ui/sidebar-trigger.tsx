"use client";
import { useTranslations } from "next-intl";
import { PanelLeft } from "lucide-react";
import { Button } from "./button";
import { useSidebar } from "./use-sidebar";

export function SidebarTrigger({ placement = "header" }: { placement?: "header" | "sidebar" }) {
  const t = useTranslations("UI");
  const { isMobile, open, openMobile, toggleSidebar } = useSidebar();
  if ((placement === "sidebar") === isMobile) return null;
  const label = isMobile ? t("toggleNavigation") : open ? t("collapseSidebar") : t("expandSidebar");
  return (
    <Button data-slot="sidebar-trigger" data-sidebar="trigger" variant="ghost" size="icon"
      aria-label={label} title={label} aria-controls="workspace-navigation"
      aria-expanded={isMobile ? openMobile : open} onClick={toggleSidebar}>
      <PanelLeft />
    </Button>
  );
}
