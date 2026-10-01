import { TabsList } from "@/components/ui/tabs-list";
import { TabsTrigger } from "@/components/ui/tabs-trigger";
import { Avatar } from "@/components/ui/avatar";
import { AvatarFallback } from "@/components/ui/avatar-fallback";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import {
  ChartNoAxesCombined,
  Layers3,
  List,
  Settings2,
  Wallet as WalletIcon,
} from "lucide-react";

const tabs = [
  { name: "Transactions", icon: List },
  { name: "Wallet", icon: WalletIcon },
  { name: "Report", icon: ChartNoAxesCombined },
  { name: "Settings", icon: Settings2 },
];

export function Sidebar({ name, tab }: { name: string; tab: string }) {
  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <Layers3 /> personal ledger<span className="brand-dot">.</span>
      </Link>
      <span className="nav-label">YOUR WORKSPACE</span>
      <TabsList className="workspace-tabs" aria-label="Workspace">
        {tabs.map(({ name, icon: Icon }) => (
          <TabsTrigger
            key={name}
            className={tab === name ? "nav-item active" : "nav-item"}
            value={name}
          >
            <Icon size={19} />
            {name}
            {tab === name && <span className="active-dot" />}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="sidebar-bottom">
        <div className="private-note">
          <Layers3 size={23} />{" "}
          <span>
            A little more clarity.
            <br />
            <small>One transaction at a time.</small>
          </span>
        </div>
        <Separator />
        <div className="profile">
          <Avatar>
            <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <strong>{name}</strong>
            <small>Personal account</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
