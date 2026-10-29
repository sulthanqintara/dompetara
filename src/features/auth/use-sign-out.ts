"use client";

import { useRouter } from "next/navigation";
import { signOut } from "./api";

export function useSignOut(setPending: (pending: boolean) => void, setError: (error: string) => void) {
  const router = useRouter();
  return async () => {
    setPending(true);
    try {
      await signOut();
      router.push("/sign-in");
      router.refresh();
    } catch {
      setError("Could not sign out. Please try again.");
      setPending(false);
    }
  };
}
