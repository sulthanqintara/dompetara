"use client";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BrandWordmark } from "@/features/branding/components/brand-wordmark";
import { ledgerSections } from "../../navigation";
import { LedgerLoading } from "../shared/ledger-loading";

export function LedgerBootLoading() {
  const pathname = usePathname();
  const t = useTranslations("UI");
  const section = ledgerSections.find(({ href }) => href === pathname) ?? ledgerSections[0];
  return <main className="ledger-boot-loading" aria-busy="true" aria-label={t("loadingWorkspaceContent")}>
    <header className="ledger-boot-heading"><BrandWordmark size={32} /><h1>{t(section.key)}</h1></header>
    <LedgerLoading view={section.name} />
  </main>;
}
