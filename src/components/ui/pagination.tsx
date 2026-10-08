import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { cn } from "cn";

export function Pagination({ className, ...props }: ComponentProps<"nav">) {
  const t = useTranslations("UI");
  return <nav role="navigation" aria-label={t("pagination")} data-slot="pagination" className={cn("mx-auto flex w-full justify-center", className)} {...props} />;
}
