import { useLocation } from "react-router-dom";
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
  const title = titleFromPath(pathname);

  const onLogout = async () => {
    // DO NOT refactor auth—just call signOut.
    await supabase.auth.signOut();
  };

  return (
    <header className="h-14 shrink-0 border-b border-zinc-900 bg-zinc-950/60 backdrop-blur">
      <div className="h-full px-4 flex items-center justify-between">
        <div className="text-zinc-50 font-semibold">{title}</div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md px-3 py-2 text-sm text-zinc-300 hover:text-zinc-50 hover:bg-zinc-900/60 border border-transparent hover:border-zinc-800 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}