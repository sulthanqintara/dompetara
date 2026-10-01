import { Sidebar as SidebarPanel } from "@/components/ui/sidebar";
import { SidebarHeader } from "@/components/ui/sidebar-header";
import { SidebarContent } from "@/components/ui/sidebar-content";
import { SidebarFooter } from "@/components/ui/sidebar-footer";
import { useSidebar } from "@/components/ui/use-sidebar";
import { WorkspaceNavigation } from "./workspace-navigation";
import { Avatar } from "@/components/ui/avatar";
import { AvatarFallback } from "@/components/ui/avatar-fallback";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { Layers3 } from "lucide-react";

export function Sidebar({ name, tab }: { name: string; tab: string }) {
  const { isPhone } = useSidebar();
  if (isPhone) return <WorkspaceNavigation tab={tab} />;
  return (
    <SidebarPanel>
      <SidebarHeader className="ledger-sidebar-header">
        <Link href="/" className="brand">
          <Layers3 /> personal ledger<span className="brand-dot">.</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="ledger-sidebar-content">
        <span className="nav-label">YOUR WORKSPACE</span>
        <WorkspaceNavigation tab={tab} />
      </SidebarContent>
      <SidebarFooter className="sidebar-bottom">
        <div className="private-note">
          <Layers3 size={23} />{" "}
          <span>
            A little more clarity.
            <br />
            <small>One transaction at a time.</small>
          </span>
        </div>
        <Separator />
        <div className="profile">
          <Avatar>
            <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <strong>{name}</strong>
            <small>Personal account</small>
          </div>
        </div>
      </SidebarFooter>
    </SidebarPanel>
  );
}
