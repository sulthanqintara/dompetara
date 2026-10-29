import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { useSignOut } from "@/features/auth/use-sign-out";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteAccountDialog } from "@/features/auth/components/delete-account-dialog";

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
  const signOut = useSignOut(setPending, setError);
  return (
    <Card className="settings-panel">
      <h3>{t("yourAccount")}</h3>
      <p>
        {name} · {email}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          className="min-h-11"
          disabled={pending}
          onClick={signOut}
        >
          <LogOut size={16} />
          {t("signOut")}
        </Button>
        <DeleteAccountDialog pending={pending} setPending={setPending} />
      </div>
    </Card>
  );
}
