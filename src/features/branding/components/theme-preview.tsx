import type { CSSProperties } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "@/features/ledger/format";
import { designColors } from "../design-system";
import styles from "./style-guide.module.css";

export async function ThemePreview({ mode }: { mode: "light" | "dark" }) {
  const [t, locale] = await Promise.all([getTranslations("UI"), getLocale()]);
  const variables = Object.fromEntries(designColors.map((color) => [`--${color.token}`, color[mode]])) as CSSProperties;
  return <section className={`${styles.preview} ${mode === "light" ? "theme-light" : "dark"}`} style={variables} aria-labelledby={`${mode}-heading`}>
    <h2 id={`${mode}-heading`}>{t(mode === "light" ? "styleGuideLight" : "styleGuideDark")}</h2>
    <Card className={styles.specimen}>
      <span className={styles.kicker}>{t("styleGuideBalance")}</span>
      <div className={styles.amount}>{format(125000000, "IDR", locale)}</div>
      <p>{t("styleGuideSampleNote")}</p>
      <div className={styles.statuses}>
        <span style={{ color: "var(--income)" }}><ArrowDownLeft aria-hidden="true" />{t("styleGuideIncome")}</span>
        <span style={{ color: "var(--destructive)" }}><ArrowUpRight aria-hidden="true" />{t("styleGuideExpense")}</span>
        <span style={{ color: "var(--transfer)" }}><ArrowLeftRight aria-hidden="true" />{t("styleGuideTransfer")}</span>
      </div>
      <div className={styles.controls}>
        <Button type="button">{t("styleGuidePrimaryAction")}</Button>
        <Button type="button" variant="secondary">{t("styleGuideSecondaryAction")}</Button>
        <Button type="button" disabled>{t("styleGuideDisabled")}</Button>
      </div>
      <div className={styles.field}>
        <Label htmlFor={`${mode}-sample-input`}>{t("styleGuideInputLabel")}</Label>
        <Input id={`${mode}-sample-input`} placeholder={t("styleGuideInputPlaceholder")} />
      </div>
      <p className={styles.demoNote}>{t("styleGuideDemoNote")}</p>
    </Card>
  </section>;
}
