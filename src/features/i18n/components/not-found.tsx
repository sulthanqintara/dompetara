import { useTranslations } from "next-intl";
import Link from "next/link";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

export function NotFound() {
  const t = useTranslations("UI");
  return <main className="grid min-h-dvh place-items-center p-4">
    <Empty className="w-full max-w-sm">
      <h1>404</h1>
      <h2>{t("pageNotFound")}</h2>
      <Button className="min-h-11 whitespace-normal" nativeButton={false} render={<Link href="/" />}>{t("returnHome")}</Button>
    </Empty>
  </main>;
}
