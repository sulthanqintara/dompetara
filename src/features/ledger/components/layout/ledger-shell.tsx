"use client";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar-provider";
import { SidebarTrigger } from "@/components/ui/sidebar-trigger";
import { TabsContent } from "@/components/ui/tabs-content";
import { LedgerError } from "../shared/ledger-error";
import { useLedgerContext } from "../../use-ledger-context";
import { ledgerSections } from "../../navigation";
import { WorkspaceTabs } from "../navigation/workspace-tabs";
import { Sidebar } from "../navigation/sidebar";
import { AccountMenu } from "../navigation/account-menu";
import { LedgerActions } from "../navigation/ledger-actions";
import { LedgerEditor } from "../editor/ledger-editor";
import { BrandWordmark } from "@/features/branding/components/brand-wordmark";
import { NavigationContext } from "../../navigation-context";
import { LedgerLoading } from "../shared/ledger-loading";
import { ThemeToggle } from "@/features/theme/components/theme-toggle";

export function LedgerShell({ children }: { children: ReactNode }) {
  const t = useTranslations("UI");
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [previousPath, setPreviousPath] = useState(pathname);
  // Reset locally on route commit, including back/forward navigation.
  if (previousPath !== pathname) {
    setPreviousPath(pathname);
    setPendingHref(null);
  }
  useEffect(() => {
    const cancel = () => setPendingHref(null);
    window.addEventListener("popstate", cancel);
    return () => window.removeEventListener("popstate", cancel);
  }, []);
  const loading = pendingHref !== null && pendingHref !== pathname;
  const section =
    ledgerSections.find((item) => item.href === (loading ? pendingHref : pathname)) ?? ledgerSections[0];
  const tab = section.name;
  const { editor } = useLedgerContext();
  return (
    <NavigationContext.Provider value={setPendingHref}><SidebarProvider>
      <WorkspaceTabs className="app-shell" value={tab}>
        <Sidebar tab={tab} />
        <main
          className={`workspace${tab === "Transactions" || tab === "Wallet" ? " workspace-with-action" : ""}`}
        >
          <header className="topbar">
            <div className="topbar-navigation">
              <SidebarTrigger />
              <h1 className="mobile-page-title">{t(section.key)}</h1>
            </div>
            <div className="topbar-actions"><ThemeToggle /><AccountMenu /></div>
          </header>
          <div className="page-content">
            <div className="page-heading">
              <div className="desktop-page-title">
                <h1>{t(section.key)}</h1>
              </div>
              <LedgerActions tab={tab} />
            </div>
            {!editor && <LedgerError />}
            <TabsContent
              key={section.href}
              value={tab}
              aria-label={t(section.key)}
              className="route-content"
            >
              {loading ? <LedgerLoading /> : children}
            </TabsContent>
          </div>
          <footer className="workspace-footer"><BrandWordmark size={32} /></footer>
        </main>
        <LedgerEditor />
      </WorkspaceTabs>
    </SidebarProvider></NavigationContext.Provider>
  );
}
