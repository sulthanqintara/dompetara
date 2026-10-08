import { useTranslations } from "next-intl";
import * as React from "react";
import { cn } from "cn";

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  const t = useTranslations("UI");
  return (
    <nav
      aria-label={t("breadcrumb")}
      data-slot="breadcrumb"
      className={cn(className)}
      {...props}
    />
  );
}

export { Breadcrumb };
