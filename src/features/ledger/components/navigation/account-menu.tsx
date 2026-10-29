import { useTranslations } from "next-intl";
import { ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { AvatarFallback } from "@/components/ui/avatar-fallback";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu-trigger";
import { DropdownMenuContent } from "@/components/ui/dropdown-menu-content";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu-item";
import { useSignOut } from "@/features/auth/use-sign-out";
import { useLedgerStore } from "../../use-ledger-store";
export function AccountMenu() {
  const t = useTranslations("UI");
  const name = useLedgerStore((state) => state.name);
  const email = useLedgerStore((state) => state.email);
  const pending = useLedgerStore((state) => state.pending);
  const setPending = useLedgerStore((state) => state.setPending);
  const setError = useLedgerStore((state) => state.setError);
  const signOut = useSignOut(setPending, setError);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "U";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="account-trigger"
            aria-label={t("accountMenu")}
          />
        }
      >
        <Avatar className="size-8">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="account-name">{name || email}</span>
        <ChevronDown size={16} className="account-chevron" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="account-menu">
        <div className="account-menu-details">
          <strong>{name}</strong>
          <span>{email}</span>
        </div>
        <DropdownMenuItem
          disabled={pending}
          onClick={signOut}
        >
          <LogOut />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
