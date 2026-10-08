"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LedgerSelect } from "@/features/ledger/components/shared/ledger-select";
import { saveLanguage } from "../api";
import { localeSchema } from "../i18n";

export function LanguageSettings() {
  const locale = useLocale();
  const t = useTranslations("UI");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return <Card className="settings-panel">
    <h3>{t("language")}</h3>
    <LedgerSelect label={t("language")} value={locale} disabled={pending}
      options={[{ value: "en", label: t("english") }, { value: "id", label: t("bahasaIndonesia") }]}
      onValueChange={async (value) => {
        setPending(true);
        setError(false);
        try {
          await saveLanguage(localeSchema.parse(value));
          router.refresh();
        } catch {
          setError(true);
        } finally {
          setPending(false);
        }
      }} />
    {error && <Alert variant="destructive">{t("couldNotSaveYourLanguagePleaseTryAgain")}</Alert>}
  </Card>;
}
