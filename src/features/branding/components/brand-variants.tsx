import { useTranslations } from "next-intl";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import styles from "./icon-gallery.module.css";

export function BrandVariants() {
  const t = useTranslations("UI");
  return (
    <section className={styles.variants} aria-labelledby="variants-title">
      <h2 id="variants-title">{t("pocketDTransparentVariants")}</h2>
      <p>{t("theSameMarkWithTransparentCutoutsAndNoBackground")}</p>
      <div className={styles.variantGrid}>
        {[
          { file: "dompetara-mark", label: t("subtleGreen"), note: t("usedThroughoutTheApp") },
          { file: "dompetara-mark-mono", label: t("monochrome"), note: t("singleColorCurrentColorWhenInlined") },
        ].map(({ file, label, note }) => (
          <Card key={file} className={styles.variantCard}>
            <div className={styles.transparentStage}>
              <Image src={`/icons/${file}.svg`} alt={t("transparentIcon", { name: label })} width={144} height={144} unoptimized />
            </div>
            <h3>{label}</h3>
            <p>{note}</p>
            <Button variant="outline" nativeButton={false} render={<a href={`/icons/${file}.svg`} download />} aria-label={t("downloadTransparentSVG", { name: label })}>{t("downloadSVG")}</Button>
          </Card>
        ))}
      </div>
    </section>
  );
}
