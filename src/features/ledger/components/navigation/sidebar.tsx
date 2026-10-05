import { Sidebar as SidebarPanel } from "@/components/ui/sidebar";
import { SidebarHeader } from "@/components/ui/sidebar-header";
import { SidebarContent } from "@/components/ui/sidebar-content";
import { SidebarFooter } from "@/components/ui/sidebar-footer";
import { SidebarTrigger } from "@/components/ui/sidebar-trigger";
import { useSidebar } from "@/components/ui/use-sidebar";
import { WorkspaceNavigation } from "./workspace-navigation";
import { Avatar } from "@/components/ui/avatar";
import { AvatarFallback } from "@/components/ui/avatar-fallback";
import Link from "next/link";
import { Layers3 } from "lucide-react";

export function Sidebar({ name, tab }: { name: string; tab: string }) {
  const { isPhone } = useSidebar();
  if (isPhone) return <WorkspaceNavigation tab={tab} />;
  return (
    <SidebarPanel>
      <SidebarHeader className="ledger-sidebar-header">
        <Link href="/" className="brand" aria-label="Dompetara">
          <Layers3 /><span className="brand-name">Dompetara<span className="brand-dot">.</span></span>
        </Link>
        <SidebarTrigger placement="sidebar" />
      </SidebarHeader>
      <SidebarContent className="ledger-sidebar-content">
        <WorkspaceNavigation tab={tab} />
      </SidebarContent>
      <SidebarFooter className="sidebar-bottom">
        <div className="profile" title={name}>
          <Avatar>
            <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <strong>{name}</strong>
          </div>
        </div>
      </SidebarFooter>
    </SidebarPanel>
  );
}
