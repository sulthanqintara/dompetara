import type { MetadataRoute } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { colorScales } from "@/features/branding/design-system";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("UI");
  return {
    "id": "/",
    "name": "Dompetara",
    "short_name": "Dompetara",
    "description": t("trackYourIncomeAndExpensesAllInOnePlace"),
    "lang": await getLocale(),
    "start_url": "/",
    "scope": "/",
    "display": "standalone",
    "background_color": colorScales.neutral[100],
    "theme_color": colorScales.brand[500],
    "icons": [
      {
        "src": "/icons/icon-192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "any"
      },
      {
        "src": "/icons/icon-512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any"
      },
      {
        "src": "/icons/icon-maskable-512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "maskable"
      }
    ]
  };
}
