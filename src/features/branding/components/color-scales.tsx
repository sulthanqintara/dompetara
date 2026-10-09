import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { colorHsl, colorScales, scaleLabels } from "../design-system";
import styles from "./style-guide.module.css";

export async function ColorScales() {
  const t = await getTranslations("UI");
  return <section className={styles.scales} aria-labelledby="color-scales-heading">
    <h2 id="color-scales-heading">{t("styleGuideScalesTitle")}</h2>
    <p>{t("styleGuideScalesIntroduction")}</p>
    <p>{t("styleGuideShadeUsage")}</p>
    {Object.entries(scaleLabels).map(([family, label]) => <Card className={styles.scaleCard} key={family}>
      <h3>{t(label)}</h3>
      <ol className={styles.shades}>
        {Object.entries(colorScales[family as keyof typeof colorScales]).map(([shade, hex]) => <li key={shade}>
          <span className={styles.shadeFill} style={{ background: hex }} aria-hidden="true" />
          <div className={styles.shadeLabel}><strong>{shade}</strong>{shade === "500" && <Badge variant="secondary">{t("styleGuideBaseShade")}</Badge>}</div>
          <code>{hex}</code>
          <code>{colorHsl(hex)}</code>
        </li>)}
      </ol>
    </Card>)}
  </section>;
}
