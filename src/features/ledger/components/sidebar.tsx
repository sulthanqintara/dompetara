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

export function Sidebar({
  name,
  tab,
  onTabChange,
}: {
  name: string;
  tab: string;
  onTabChange: (tab: string) => void;
}) {
  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <Layers3 /> personal ledger<span className="brand-dot">.</span>
      </Link>
      <span className="nav-label">YOUR WORKSPACE</span>
      <nav>
        {tabs.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={tab === name ? "nav-item active" : "nav-item"}
            onClick={() => onTabChange(name)}
            aria-current={tab === name ? "page" : undefined}
          >
            <Icon size={19} />
            {name}
            {tab === name && <span className="active-dot" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="private-note">
          <Layers3 size={23} />{" "}
          <span>
            A little more clarity.
            <br />
            <small>One transaction at a time.</small>
          </span>
        </div>
        <div className="profile">
          <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{name}</strong>
            <small>Personal account</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
