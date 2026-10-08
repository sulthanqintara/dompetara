import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { IconGallery } from "@/features/branding/components/icon-gallery";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("UI");
  return { title: t("dompetaraIconExplorations") };
}

export default function IconPreviewPage() {
  return <IconGallery />;
}
