import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function titleFromPath(pathname) {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/trades") return "Trades";
  if (pathname === "/trades/new") return "Add Trade";
  if (pathname === "/analytics") return "Analytics";
  if (pathname === "/settings") return "Settings";
  return "Journal";
}

export default function Topbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = titleFromPath(pathname);

  async function handleLogout() {
    await supabase.auth.signOut();

    // IMPORTANT: client-side navigation (no full reload)
    navigate("/login", { replace: true });
  }

  return (
    <div className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-6">
      <div className="flex items-center gap-6">
        <div className="text-sm font-semibold tracking-wider">
          <span style={{ color: "var(--tx-silver)" }}>Terminal</span>
          <span style={{ color: "var(--tx-blue)" }}>X</span>
        </div>
        <div className="text-xs text-zinc-500 uppercase tracking-widest">
          {title}
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="text-xs text-zinc-400 hover:text-red-300 transition"
      >
        Logout
      </button>
    </div>
  );
}
