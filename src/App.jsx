// src/App.jsx
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

import Layout from "./components/layout/Layout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Trades from "./pages/Trades";
import AddTrade from "./pages/AddTrade";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";

/**
 * NOTE:
 * - No auth refactor.
 * - Adds an unauthenticated landing gate at /auth.
 * - Keeps existing /login and /register routes intact.
 */

function TerminalXWordmark({ size = "text-3xl" }) {
  return (
    <div className={`font-semibold tracking-tight ${size}`}>
      <span className="text-tx-silver">Terminal</span>
      <span className="text-tx-blue">X</span>
    </div>
  );
}

function AuthGate() {
  const navigate = useNavigate();

  const fullText = "TerminalX Trade Tracker";
  const [typed, setTyped] = useState("");

  useEffect(() => {
    let i = 0;
    setTyped("");
    const tick = () => {
      i += 1;
      setTyped(fullText.slice(0, i));
      if (i < fullText.length) {
        t = window.setTimeout(tick, 32);
      }
    };
    let t = window.setTimeout(tick, 250);
    return () => window.clearTimeout(t);
  }, []);

  const subtitle = useMemo(
    () =>
      "Institutional-grade performance analytics for funded and aspiring funded futures traders.",
    []
  );

  return (
    <div className="tx-page min-h-screen flex items-center justify-center px-5">
      <div className="tx-bg-ornament" aria-hidden="true" />
      <div className="w-full max-w-3xl relative">
        <div className="tx-streak-border rounded-2xl p-6 md:p-8">
          <div className="rounded-2xl bg-tx-panel/70 border border-tx-border p-6 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <TerminalXWordmark size="text-2xl md:text-3xl" />
              <div className="hidden md:flex items-center gap-2 text-[11px] text-zinc-500">
                <span className="tx-dot tx-dot-blue" />
                <span>secure auth</span>
                <span className="tx-dot tx-dot-red ml-3" />
                <span>stat-correct analytics</span>
              </div>
            </div>

            <div className="mt-8">
              <div className="text-[12px] text-zinc-500 mb-2">Welcome</div>
              <div className="text-2xl md:text-4xl font-semibold text-zinc-100 tracking-tight">
                <span className="tx-type">{typed}</span>
                <span className="tx-caret" aria-hidden="true">▍</span>
              </div>
              <div className="mt-3 text-sm md:text-base text-zinc-400 max-w-2xl">
                {subtitle}
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="tx-btn tx-btn-primary"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="tx-btn tx-btn-secondary"
              >
                Signup
              </button>
            </div>

            <div className="mt-6 text-xs text-zinc-500">
              Private beta access only. Signup requires an entry code.
            </div>

            <div className="mt-3 text-[11px] text-zinc-600">
              Tip: bookmark{" "}
              <Link className="underline decoration-zinc-700 hover:text-zinc-400" to="/login">
                /login
              </Link>{" "}
              if you prefer a direct route.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  if (loading) return null;

  return (
  <Routes>
    {!session ? (
      <>
        <Route path="/auth" element={<AuthGate />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </>
    ) : (
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="trades" element={<Trades />} />
        <Route path="trades/new" element={<AddTrade />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    )}
  </Routes>
);
}
