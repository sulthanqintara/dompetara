import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { readPreferences } from "@/features/i18n/read-preferences";
import { resolveLocale } from "@/features/i18n/i18n";

export default getRequestConfig(async () => {
  const [{ preferences }, cookieStore, requestHeaders] = await Promise.all([
    readPreferences(), cookies(), headers(),
  ]);
  const locale = resolveLocale(preferences?.locale, cookieStore.get("locale")?.value, requestHeaders.get("accept-language"));
  return {
    locale,
    messages: (locale === "id" ? await import("../../../messages/id.json") : await import("../../../messages/en.json")).default,
  };
});
