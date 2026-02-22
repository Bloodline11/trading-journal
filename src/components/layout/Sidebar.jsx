import { NavLink } from "react-router-dom";

const navLinkBase =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors border";

const navLinkActive =
  "bg-zinc-900 text-blue-300 border-zinc-800";

const navLinkIdle =
  "border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 hover:border-zinc-800";

function Item({ to, label, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `${navLinkBase} ${isActive ? navLinkActive : navLinkIdle}`
      }
    >
      {label}
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-60 bg-zinc-950 border-r border-zinc-800 flex flex-col">
      <div className="h-14 flex items-center px-5 border-b border-zinc-800 text-sm font-semibold tracking-wider">
        <span style={{ color: "var(--tx-silver)" }}>Terminal</span>
        <span style={{ color: "var(--tx-blue)" }}>X</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <Item to="/" label="Dashboard" end />
        <Item to="/trades" label="Trades" />
        <Item to="/trades/new" label="Add Trade" />
        <Item to="/analytics" label="Analytics" />
        <Item to="/settings" label="Settings" />
      </nav>
    </aside>
  );
}
