import { Sidebar as SidebarPanel } from "@/components/ui/sidebar";
import { SidebarHeader } from "@/components/ui/sidebar-header";
import { SidebarContent } from "@/components/ui/sidebar-content";
import { SidebarFooter } from "@/components/ui/sidebar-footer";
import { SidebarTrigger } from "@/components/ui/sidebar-trigger";
import { useSidebar } from "@/components/ui/use-sidebar";
import { WorkspaceNavigation } from "./workspace-navigation";
import Link from "next/link";
import { BrandWordmark } from "@/features/branding/components/brand-wordmark";

export function Sidebar({ tab }: { tab: string }) {
  const { isPhone } = useSidebar();
  if (isPhone) return <WorkspaceNavigation tab={tab} />;
  return (
    <SidebarPanel>
      <SidebarHeader className="ledger-sidebar-header">
        <Link href="/" className="brand" aria-label="Dompetara">
          <BrandWordmark />
        </Link>
      </SidebarHeader>
      <SidebarContent className="ledger-sidebar-content">
        <WorkspaceNavigation tab={tab} />
      </SidebarContent>
      <SidebarFooter className="sidebar-bottom">
        <SidebarTrigger placement="sidebar" />
      </SidebarFooter>
    </SidebarPanel>
  );
}
