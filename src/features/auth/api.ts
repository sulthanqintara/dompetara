import { authClient } from "@/lib/auth-client";
export async function signOut() {
  const result = await authClient.signOut();
  if (result.error) throw new Error(result.error.message);
}
