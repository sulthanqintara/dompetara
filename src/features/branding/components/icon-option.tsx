import { useTranslations } from "next-intl";
import Image from "next/image";
import { ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import styles from "./icon-gallery.module.css";

export function IconOption({ file, name, description, color, tint, note, number }: {
  file: string; name: string; description: string; color: string; tint: string; note: string; number: number;
}) {
  const t = useTranslations("UI");
  const src = `/dompetara-icons/${file}.svg`;
  return (
    <Card className={styles.card}>
      <div className={styles.stage} style={{ background: tint }}>
        <span className={styles.number} style={{ color }}>0{number}</span>
        <Image src={src} alt={t("appIcon", { name })} width={144} height={144} unoptimized className={styles.heroIcon} />
        <span className={styles.note} style={{ color }}>{note}</span>
      </div>
      <div className={styles.details}>
        <h2>{name}</h2>
        <p className={styles.description}>{description}</p>
        <div className={styles.context}>
          <Image src={src} alt="" width={40} height={40} unoptimized />
          <span className={styles.appName}>{t("yourMoneyInOrder")}</span>
        </div>
        <div className={styles.sizes} aria-label={t("iconPreviewsAt4832And16Pixels")}>
          <span>{t("smallSizeCheck")}</span>
          {[48, 32, 16].map((size) => <figure key={size}><Image src={src} alt={t("iconPixels", { name, size })} width={size} height={size} unoptimized /><figcaption>{size}</figcaption></figure>)}
        </div>
        <Button variant="outline" nativeButton={false} render={<a href={src} download={`${file}.svg`} />} className={styles.download} aria-label={t("downloadNamedSVG", { name })}>
          <ArrowDownToLine />  {t("downloadSVG")}</Button>
      </div>
    </Card>
  );
}
