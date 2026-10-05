import type { Metadata } from "next";
import { IconGallery } from "@/features/branding/components/icon-gallery";

export const metadata: Metadata = { title: "Dompetara · Icon explorations" };

export default function IconPreviewPage() {
  return <IconGallery />;
}
