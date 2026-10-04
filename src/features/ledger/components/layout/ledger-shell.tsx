"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar-provider";
import { SidebarTrigger } from "@/components/ui/sidebar-trigger";
import { TabsContent } from "@/components/ui/tabs-content";
import { Button } from "@/components/ui/button";
import { LedgerError } from "../shared/ledger-error";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { BreadcrumbList } from "@/components/ui/breadcrumb-list";
import { BreadcrumbItem } from "@/components/ui/breadcrumb-item";
import { BreadcrumbSeparator } from "@/components/ui/breadcrumb-separator";
import { BreadcrumbPage } from "@/components/ui/breadcrumb-page";
import { Plus } from "lucide-react";
import { useLedgerContext } from "../../use-ledger-context";
import { ledgerSections } from "../../navigation";
import { WorkspaceTabs } from "../navigation/workspace-tabs";
import { Sidebar } from "../navigation/sidebar";
import { LedgerEditor } from "../editor/ledger-editor";

export function LedgerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const section =
    ledgerSections.find((item) => item.href === pathname) ?? ledgerSections[0];
  const tab = section.name;
  const { name, data, editor, setEditor } = useLedgerContext();
  return (
    <SidebarProvider>
      <WorkspaceTabs className="app-shell" value={tab}>
        <Sidebar name={name} tab={tab} />
        <main className="workspace">
          <header className="topbar">
            <div className="topbar-navigation">
              <SidebarTrigger />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>My workspace</BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{tab}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <Badge variant="secondary">Private ledger</Badge>
          </header>
          <div className="page-content">
            <div className="page-heading">
              <div>
                <h1>{tab}</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                {data && tab !== "Settings" && (
                  <Button
                    onClick={() =>
                      setEditor({
                        type:
                          tab === "Wallet" || !data.wallets.length
                            ? "wallet"
                            : "entry",
                      })
                    }
                  >
                    <Plus size={17} />
                    {tab === "Wallet" || !data.wallets.length
                      ? "Add wallet"
                      : "Add transaction"}
                  </Button>
                )}
              </div>
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
          <footer>
            PERSONAL LEDGER
          </footer>
        </main>
        <LedgerEditor />
      </WorkspaceTabs>
    </SidebarProvider>
  );
}
