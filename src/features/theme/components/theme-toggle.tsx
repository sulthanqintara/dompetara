"use client";

import { useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const t = useTranslations("UI");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [hasSwitched, setHasSwitched] = useState(false);
  const dark = mounted && resolvedTheme === "dark";
  const label = t(dark ? "switchToLightTheme" : "switchToDarkTheme");
  return <Button variant="ghost" className="theme-toggle" disabled={!mounted} aria-label={label} title={label} aria-pressed={dark}
    onClick={() => { setHasSwitched(true); setTheme(dark ? "light" : "dark"); }}>
    {mounted ? (dark
      ? <Moon key="dark" aria-hidden="true" data-theme="dark" className={hasSwitched ? "theme-toggle-icon is-switching" : "theme-toggle-icon"} />
      : <Sun key="light" aria-hidden="true" data-theme="light" className={hasSwitched ? "theme-toggle-icon is-switching" : "theme-toggle-icon"} />)
      : <span className="size-4" />}
  </Button>;
}
