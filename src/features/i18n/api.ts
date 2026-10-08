import type { Locale } from "./i18n";

export async function saveLanguage(locale: Locale) {
  const response = await fetch("/api/preferences", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }),
  });
  if (!response.ok) throw new Error("Could not save your language. Please try again.");
}

export async function markLanguagePromptShown() {
  const response = await fetch("/api/preferences", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  if (!response.ok) throw new Error("Could not save your language. Please try again.");
}
