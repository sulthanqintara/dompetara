import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";

export const readPreferences = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  const [preferences] = session ? await db.select().from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id)) : [];
  return { session, preferences };
});
