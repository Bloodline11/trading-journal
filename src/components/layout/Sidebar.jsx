import { NavLink } from "react-router-dom";

const navLinkBase =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors border border-transparent";

const navLinkActive =
  "bg-zinc-900 text-zinc-50 border-zinc-800";

const navLinkIdle =
  "text-zinc-300 hover:text-zinc-50 hover:bg-zinc-900/60";

function Item({ to, label, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `${navLinkBase} ${isActive ? navLinkActive : navLinkIdle}`
      }
    >
      <span className="text-zinc-400">•</span>
      <span className="font-medium">{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-[260px] shrink-0 border-r border-zinc-900 bg-zinc-950">
      <div className="px-4 py-4 border-b border-zinc-900">
        <div className="text-zinc-50 font-semibold tracking-tight">
          Trading Journal
        </div>
        <div className="text-xs text-zinc-400 mt-1">
          Performance tracking (futures)
        </div>
      </div>

      <nav className="px-3 py-3 space-y-1">
        <Item to="/" label="Dashboard" end />
        <Item to="/trades" label="Trades" />
        <Item to="/trades/new" label="Add Trade" />
        <div className="my-2 border-t border-zinc-900" />
        <Item to="/analytics" label="Analytics" />
        <Item to="/settings" label="Settings" />
      </nav>
    </aside>
  );
}