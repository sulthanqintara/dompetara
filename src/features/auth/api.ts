import { authClient } from "@/lib/auth-client";
export async function signOut() {
  const result = await authClient.signOut();
  if (result.error) throw new Error(result.error.message);
}

export async function deleteAccount() {
  const result = await authClient.deleteUser();
  if (result.error) {
    throw new Error(result.error.code === "SESSION_EXPIRED"
      ? "Please sign out and sign in again before deleting your account."
      : "Could not delete your account. Please try again.");
  }
}
