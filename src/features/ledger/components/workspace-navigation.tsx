import { TabsList } from "@/components/ui/tabs-list";
import { TabsTrigger } from "@/components/ui/tabs-trigger";
import { TabsIndicator } from "@/components/ui/tabs-indicator";
import { useSidebar } from "@/components/ui/use-sidebar";
import { ChartNoAxesCombined, List, Settings2, Wallet } from "lucide-react";

const sections = [
  { name: "Transactions", label: "History", icon: List },
  { name: "Wallet", label: "Wallet", icon: Wallet },
  { name: "Report", label: "Report", icon: ChartNoAxesCombined },
  { name: "Settings", label: "Settings", icon: Settings2 },
];

export function WorkspaceNavigation({ tab }: { tab: string }) {
  const { isPhone, isMobile, open, setOpenMobile } = useSidebar();
  return (
    <TabsList className={isPhone ? "mobile-navigation" : "workspace-tabs"} aria-label="Workspace">
      {sections.map(({ name, label, icon: Icon }) => (
        <TabsTrigger key={name} value={name} aria-label={name} title={!isMobile && !open ? name : undefined}
          className={isPhone ? "mobile-nav-item" : tab === name ? "nav-item active" : "nav-item"}
          onClick={() => {
            setOpenMobile(false);
            if (isPhone) window.scrollTo({ top: 0, behavior: "instant" });
          }}>
          {isPhone ? <span className="mobile-nav-icon" aria-hidden="true"><Icon size={18} /></span> : <Icon size={18} />}
          <span className="nav-text">{isPhone ? label : name}</span>
          {!isPhone && tab === name && <span className="active-dot" />}
        </TabsTrigger>
      ))}
      {isPhone && <TabsIndicator className="mobile-nav-indicator" />}
    </TabsList>
  );
}
