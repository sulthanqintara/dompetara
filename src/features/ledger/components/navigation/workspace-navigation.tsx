import { useTranslations } from "next-intl";
import { TabsList } from "@/components/ui/tabs-list";
import { TabsTrigger } from "@/components/ui/tabs-trigger";
import { TabsIndicator } from "@/components/ui/tabs-indicator";
import { useSidebar } from "@/components/ui/use-sidebar";
import { ChartNoAxesCombined, List, Settings2, Wallet } from "lucide-react";
import Link from "next/link";
import { useContext } from "react";
import { ledgerSections } from "../../navigation";
import { NavigationContext } from "../../navigation-context";

const icons = [List, Wallet, ChartNoAxesCombined, Settings2];

export function WorkspaceNavigation({ tab }: { tab: string }) {
  const t = useTranslations("UI");
  const { isPhone, isMobile, open, setOpenMobile } = useSidebar();
  const navigate = useContext(NavigationContext);
  return (
    <TabsList className={isPhone ? "mobile-navigation" : "workspace-tabs"} aria-label={t("workspace")}>
      {ledgerSections.map(({ name, label, href, key }, index) => {
        const Icon = icons[index];
        return (
        <TabsTrigger key={name} value={name} aria-label={t(key)} title={!isMobile && !open ? t(key) : undefined}
          nativeButton={false} render={<Link href={href} prefetch={true} onNavigate={() => navigate?.(href)} />}
          className={isPhone ? "mobile-nav-item" : tab === name ? "nav-item active" : "nav-item"}
          onClick={() => {
            setOpenMobile(false);
            if (isPhone) window.scrollTo({ top: 0, behavior: "instant" });
          }}>
          {isPhone ? <span className="mobile-nav-icon" aria-hidden="true"><Icon size={18} /></span> : <Icon size={18} />}
          <span className="nav-text">{t(isPhone ? label : key)}</span>
        </TabsTrigger>
      ); })}
      {isPhone && <TabsIndicator className="mobile-nav-indicator" />}
    </TabsList>
  );
}
