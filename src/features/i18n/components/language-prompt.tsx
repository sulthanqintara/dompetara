"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { DialogContent } from "@/components/ui/dialog-content";
import { DialogTitle } from "@/components/ui/dialog-title";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { markLanguagePromptShown, saveLanguage } from "../api";
import type { Locale } from "../i18n";

export function LanguagePrompt({ shouldShow }: { shouldShow: boolean }) {
  const [open, setOpen] = useState(shouldShow);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const locale = useLocale() as Locale;
  const t = useTranslations("UI");
  const router = useRouter();
  useEffect(() => {
    if (shouldShow) void markLanguagePromptShown().catch(() => setError(true));
  }, [shouldShow]);
  async function choose(next: Locale) {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      await saveLanguage(next);
      setOpen(false);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return <Dialog open={open} onOpenChange={(next) => { if (!next) void choose(locale); }}>
    <DialogContent showCloseButton={false} className="language-prompt" aria-describedby="language-prompt-description"
      finalFocus={() => document.querySelector<HTMLElement>(".ledger-add-button, .account-trigger")}>
      <DialogTitle><span lang="en">{t("chooseYourLanguageEn")}</span> / <span lang="id">{t("chooseYourLanguageId")}</span></DialogTitle>
      <p id="language-prompt-description"><span lang="en">{t("changeLanguageLaterEn")}</span><br /><span lang="id">{t("changeLanguageLaterId")}</span></p>
      <div className="language-actions">
        <Button lang="en" disabled={pending} onClick={() => void choose("en")}>{t("english")}</Button>
        <Button lang="id" disabled={pending} onClick={() => void choose("id")}>{t("bahasaIndonesia")}</Button>
      </div>
      {error && <Alert variant="destructive">{t("couldNotSaveYourLanguagePleaseTryAgain")}</Alert>}
      <Button variant="outline" disabled={pending} onClick={() => void choose(locale)}>{t("continue")}</Button>
    </DialogContent>
  </Dialog>;
}
