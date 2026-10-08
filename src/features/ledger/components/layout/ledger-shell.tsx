"use client";
import type { ReactNode } from "react";
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

export function LedgerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const section =
    ledgerSections.find((item) => item.href === pathname) ?? ledgerSections[0];
  const tab = section.name;
  const { name, editor } = useLedgerContext();
  return (
    <SidebarProvider>
      <WorkspaceTabs className="app-shell" value={tab}>
        <Sidebar name={name} tab={tab} />
        <main
          className={`workspace${tab === "Transactions" || tab === "Wallet" ? " workspace-with-action" : ""}`}
        >
          <header className="topbar">
            <div className="topbar-navigation">
              <SidebarTrigger />
              <h1 className="mobile-page-title">{tab}</h1>
            </div>
            <AccountMenu />
          </header>
          <div className="page-content">
            <div className="page-heading">
              <div className="desktop-page-title">
                <h1>{tab}</h1>
              </div>
              <LedgerActions tab={tab} />
            </div>
            {!editor && <LedgerError />}
            <TabsContent
              key={pathname}
              value={tab}
              aria-label={tab}
              className="route-content"
            >
              {children}
            </TabsContent>
          </div>
          <footer className="workspace-footer"><BrandWordmark size={32} /></footer>
        </main>
        <LedgerEditor />
      </WorkspaceTabs>
    </SidebarProvider>
  );
}
