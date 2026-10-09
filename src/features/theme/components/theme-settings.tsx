"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { LedgerSelect } from "@/features/ledger/components/shared/ledger-select";

export function ThemeSettings() {
  const t = useTranslations("UI");
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  return <Card className="settings-panel">
    <h3>{t("appearance")}</h3>
    <LedgerSelect label={t("colorTheme")} value={mounted ? theme ?? "system" : "system"} disabled={!mounted} onValueChange={setTheme}
      options={[{ value: "light", label: t("styleGuideLight") }, { value: "dark", label: t("styleGuideDark") }, { value: "system", label: t("systemTheme") }]} />
    <p>{t("themeSavedOnThisDevice")}</p>
  </Card>;
}
