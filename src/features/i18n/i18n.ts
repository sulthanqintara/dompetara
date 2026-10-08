import { z } from "zod";

export const localeSchema = z.enum(["en", "id"]);
export type Locale = z.infer<typeof localeSchema>;
export const preferenceSchema = z.object({ locale: localeSchema.optional() });

export function resolveLocale(saved: unknown, cookie: unknown, acceptLanguage: string | null): Locale {
  for (const value of [saved, cookie]) {
    const parsed = localeSchema.safeParse(value);
    if (parsed.success) return parsed.data;
  }
  const preferred = (acceptLanguage ?? "").split(",").map((part, index) => {
    const [language, ...parameters] = part.trim().split(";");
    const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
    return { language, quality: quality ? Number(quality.trim().slice(2)) : 1, index };
  }).filter(({ quality }) => Number.isFinite(quality) && quality > 0 && quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)[0]?.language;
  return /^id(?:-|$)/i.test(preferred ?? "") ? "id" : "en";
}
