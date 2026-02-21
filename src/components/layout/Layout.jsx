import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { ensureDefaultAccount } from "../../lib/ensureAccount";

export default function Layout() {
  useEffect(() => {
    // Ensures every user has an accounts row (name: "Main", initial_balance: 0)
    // Users never run SQL — the app does it automatically after login.
    ensureDefaultAccount().catch((err) => {
      console.error("ensureDefaultAccount failed:", err);
    });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />

        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="p-4 md:p-6 max-w-[1600px] w-full mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}