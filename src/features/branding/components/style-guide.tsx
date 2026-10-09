import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { ThemePreview } from "./theme-preview";
import { ColorScales } from "./color-scales";
import { ColorRoleTable } from "./color-role-table";
import { ThemeToggle } from "@/features/theme/components/theme-toggle";
import styles from "./style-guide.module.css";

export async function StyleGuide() {
  const t = await getTranslations("UI");
  return <main className={styles.guide}>
    <header className={styles.intro}>
      <ThemeToggle />
      <span className={styles.kicker}>{t("styleGuideDraft")}</span>
      <h1>{t("styleGuideTitle")}</h1>
      <p>{t("styleGuideIntroduction")}</p>
    </header>
    <ColorScales />
    <div className={styles.themes}>
      <ThemePreview mode="light" />
      <ThemePreview mode="dark" />
    </div>
    <ColorRoleTable />
    <section className={styles.rules} aria-label={t("styleGuideRules")}>
      {(["Color", "Hierarchy", "Typography", "Spacing", "Meaning", "Accessibility"] as const).map((rule) => <Card key={rule} className={styles.rule}>
        <h2>{t(`styleGuide${rule}`)}</h2>
        <p>{t(`styleGuide${rule}Rule`)}</p>
      </Card>)}
    </section>
    <p className={styles.note}>{t("styleGuideBookReference")}</p>
    <p className={styles.note}>{t("styleGuideThemePlan")}</p>
  </main>;
}
