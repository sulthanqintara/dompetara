import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StyleGuide } from "@/features/branding/components/style-guide";

export async function generateMetadata(): Promise<Metadata> {
  if (process.env.NODE_ENV !== "development") notFound();
  const t = await getTranslations("UI");
  return { title: t("styleGuideTitle"), robots: { index: false, follow: false } };
}

export default function StyleGuidePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <StyleGuide />;
}
