import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import styles from "./icon-gallery.module.css";

export function BrandVariants() {
  return (
    <section className={styles.variants} aria-labelledby="variants-title">
      <h2 id="variants-title">Pocket D · Transparent variants</h2>
      <p>The same mark, with transparent cutouts and no background.</p>
      <div className={styles.variantGrid}>
        {[
          { file: "dompetara-mark", label: "Subtle green", note: "Used throughout the app" },
          { file: "dompetara-mark-mono", label: "Monochrome", note: "Single color · currentColor when inlined" },
        ].map(({ file, label, note }) => (
          <Card key={file} className={styles.variantCard}>
            <div className={styles.transparentStage}>
              <Image src={`/icons/${file}.svg`} alt={`${label} transparent Pocket D`} width={144} height={144} unoptimized />
            </div>
            <h3>{label}</h3>
            <p>{note}</p>
            <Button variant="outline" nativeButton={false} render={<a href={`/icons/${file}.svg`} download />} aria-label={`Download ${label} transparent SVG`}>Download SVG</Button>
          </Card>
        ))}
      </div>
    </section>
  );
}
