import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { ensureDefaultAccount } from "../../lib/ensureAccount";

export default function Layout() {
  useEffect(() => {
    ensureDefaultAccount().catch((err) => {
      console.error("ensureDefaultAccount error:", err);
    });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col border-l border-zinc-800 bg-zinc-950">
        <Topbar />
        <main className="flex-1 p-6 bg-zinc-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
