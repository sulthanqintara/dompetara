import { IconOption } from "./icon-option";
import styles from "./icon-gallery.module.css";
import { BrandIcon } from "./brand-icon";
import { BrandVariants } from "./brand-variants";

const options = [
  { file: "01-pocket-d", name: "Pocket D", description: "A wallet clasp meets the letter D. Familiar, confident, and unmistakably Dompetara.", color: "#186653", tint: "#e6eee5", note: "The everyday classic" },
  { file: "02-sunrise-pocket", name: "Sunrise Pocket", description: "A sun tucked into a pocket. A warm start to a healthier relationship with money.", color: "#294b42", tint: "#faf0d9", note: "A little optimism" },
  { file: "03-woven-d", name: "Woven D", description: "An interlocking monogram inspired by woven craft. Your finances, brought together.", color: "#4148a5", tint: "#ececf7", note: "Craft meets clarity" },
  { file: "04-growing-coin", name: "Growing Coin", description: "A seedling rooted in a coin. Small daily habits that grow into something bigger.", color: "#91402f", tint: "#f8e9e1", note: "Room to grow" },
  { file: "05-north-star", name: "North Star", description: "A compass for your money. A quiet reminder that every transaction has a direction.", color: "#173d48", tint: "#e4eff0", note: "Find your direction" },
];

export function IconGallery() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <BrandIcon />
        <span className={styles.edition}>BRAND EXPLORATIONS / 01</span>
      </header>
      <section className={styles.intro} aria-labelledby="gallery-title">
        <p className={styles.eyebrow}>A NEW NAME. FIVE POSSIBILITIES.</p>
        <h1 id="gallery-title">A small icon.<br /><span>A big first impression.</span></h1>
        <p>Five original directions for Dompetara. Find the one that feels like home for your money.</p>
      </section>
      <BrandVariants />
      <section className={styles.grid} aria-label="Five Dompetara icon options">
        {options.map((option, index) => <IconOption key={option.file} {...option} number={index + 1} />)}
      </section>
      <footer className={styles.footer}>
        <p>Made for Dompetara. Choose by number or name.</p>
        <p>Pure SVG · Scales to any size · No fonts or external assets</p>
      </footer>
    </main>
  );
}
