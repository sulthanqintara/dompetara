import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { readLimitedBody } from "@/lib/read-limited-body";
import { logServerError } from "@/lib/log-server-error";
import { preferenceSchema } from "./i18n";
import { enforceUserLimit } from "@/lib/security/enforce-user-limit";

export async function savePreferences(request: Request) {
  if (request.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL || request.url).origin)
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Please sign in." }, { status: 401 });
  await enforceUserLimit(session.user.id, "preferences");
  let input;
  try {
    input = preferenceSchema.parse(JSON.parse((await readLimitedBody(request.body, 1024)).toString("utf8")));
  } catch (error) {
    logServerError({ method: "POST", path: "/api/preferences", status: 400, stage: "validate preferences" }, error);
    return Response.json({ error: "Choose English or Bahasa Indonesia." }, { status: 400 });
  }
  try {
    await db.insert(userPreferences).values({ userId: session.user.id, locale: input.locale ?? null, languagePromptShownAt: new Date() })
      .onConflictDoUpdate({ target: userPreferences.userId, set: { ...(input.locale ? { locale: input.locale } : {}), languagePromptShownAt: new Date() } });
    if (input.locale) (await cookies()).set("locale", input.locale, {
      path: "/", sameSite: "lax", httpOnly: true, secure: new URL(request.url).protocol === "https:", maxAge: 31536000,
    });
    return Response.json({ locale: input.locale }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logServerError({ method: "POST", path: "/api/preferences", status: 500, stage: "save preferences" }, error);
    return Response.json({ error: "Could not save your language. Please try again." }, { status: 500 });
  }
}
