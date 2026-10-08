import { useTranslations } from "next-intl";
import { IconOption } from "./icon-option";
import styles from "./icon-gallery.module.css";
import { BrandIcon } from "./brand-icon";
import { BrandVariants } from "./brand-variants";

export function IconGallery() {
  const t = useTranslations("UI");
  const options = [
    { file: "01-pocket-d", name: "Pocket D", description: t("aWalletClaspMeetsTheLetterDFamiliarConfidentAndUnmistakablyDompetara"), color: "#186653", tint: "#e6eee5", note: t("theEverydayClassic") },
    { file: "02-sunrise-pocket", name: "Sunrise Pocket", description: t("aSunTuckedIntoAPocketAWarmStartToAHealthierRelationshipWithMoney"), color: "#294b42", tint: "#faf0d9", note: t("aLittleOptimism") },
    { file: "03-woven-d", name: "Woven D", description: t("anInterlockingMonogramInspiredByWovenCraftYourFinancesBroughtTogether"), color: "#4148a5", tint: "#ececf7", note: t("craftMeetsClarity") },
    { file: "04-growing-coin", name: "Growing Coin", description: t("aSeedlingRootedInACoinSmallDailyHabitsThatGrowIntoSomethingBigger"), color: "#91402f", tint: "#f8e9e1", note: t("roomToGrow") },
    { file: "05-north-star", name: "North Star", description: t("aCompassForYourMoneyAQuietReminderThatEveryTransactionHasADirection"), color: "#173d48", tint: "#e4eff0", note: t("findYourDirection") },
  ];
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <BrandIcon />
        <span className={styles.edition}>{t("bRANDEXPLORATIONS01")}</span>
      </header>
      <section className={styles.intro} aria-labelledby="gallery-title">
        <p className={styles.eyebrow}>{t("aNEWNAMEFIVEPOSSIBILITIES")}</p>
        <h1 id="gallery-title">{t("aSmallIcon")}<br /><span>{t("aBigFirstImpression")}</span></h1>
        <p>{t("fiveOriginalDirectionsForDompetaraFindTheOneThatFeelsLikeHomeForYourMoney")}</p>
      </section>
      <BrandVariants />
      <section className={styles.grid} aria-label={t("fiveDompetaraIconOptions")}>
        {options.map((option, index) => <IconOption key={option.file} {...option} number={index + 1} />)}
      </section>
      <footer className={styles.footer}>
        <p>{t("madeForDompetaraChooseByNumberOrName")}</p>
        <p>{t("pureSVGScalesToAnySizeNoFontsOrExternalAssets")}</p>
      </footer>
    </main>
  );
}
