import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AccountSettings({
  name,
  email,
  pending,
  setPending,
  setError,
}: {
  name: string;
  email: string;
  pending: boolean;
  setPending: (pending: boolean) => void;
  setError: (error: string) => void;
}) {
  const router = useRouter();
  return (
    <Card className="settings-panel">
      <h3>Your account</h3>
      <p>
        {name} · {email}
      </p>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const result = await authClient.signOut();
            if (result.error) throw new Error(result.error.message);
            router.push("/sign-in");
            router.refresh();
          } catch {
            setError("Could not sign out. Please try again.");
            setPending(false);
          }
        }}
      >
        <LogOut size={16} />
        Sign out
      </Button>
    </Card>
  );
}
