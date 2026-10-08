import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/features/auth/api";
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
  const t = useTranslations("UI");
  const router = useRouter();
  return (
    <Card className="settings-panel">
      <h3>{t("yourAccount")}</h3>
      <p>
        {name} · {email}
      </p>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await signOut();
            router.push("/sign-in");
            router.refresh();
          } catch {
            setError("Could not sign out. Please try again.");
            setPending(false);
          }
        }}
      >
        <LogOut size={16} />
        {t("signOut")}
      </Button>
    </Card>
  );
}
