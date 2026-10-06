import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { AvatarFallback } from "@/components/ui/avatar-fallback";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu-trigger";
import { DropdownMenuContent } from "@/components/ui/dropdown-menu-content";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu-item";
import { signOut } from "@/features/auth/api";
import { useLedgerContext } from "../../use-ledger-context";
export function AccountMenu() {
  const { name, email, pending, setPending, setError } = useLedgerContext();
  const router = useRouter();
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
            aria-label="Account menu"
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
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
