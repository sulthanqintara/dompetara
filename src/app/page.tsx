import { redirect } from "next/navigation";
import { readPreferences } from "@/features/i18n/read-preferences";

export default async function Home() {
  const { session } = await readPreferences();
  redirect(session ? "/transactions" : "/sign-in");
}
