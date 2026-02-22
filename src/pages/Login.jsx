import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setErr(error.message || "Login failed");
      return;
    }

    nav("/");
  }

  return (
    <div className="tx-page min-h-screen flex items-center justify-center px-4">
      <div className="tx-bg-ornament" />

      <div className="w-full max-w-xl tx-streak-border">
        {/* IMPORTANT: z-10 so content sits above the rail ring */}
        <div className="relative z-10 rounded-2xl bg-zinc-950/60 border border-zinc-800 p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm font-semibold tracking-wider">
              <span style={{ color: "var(--tx-silver)" }}>Terminal</span>
              <span style={{ color: "var(--tx-blue)" }}>X</span>
            </div>
            <div className="text-xs text-zinc-500">Login</div>
          </div>

          <h1 className="text-2xl font-semibold text-zinc-100">
            Welcome back
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Institutional-grade performance tracking for futures + stocks.
          </p>

          {err ? (
            <div className="tx-alert tx-alert-red mt-4">{err}</div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="tx-label">Email</label>
              <input
                className="tx-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="tx-label">Password</label>
              <input
                className="tx-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="tx-btn tx-btn-primary w-full"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="mt-5 text-xs text-zinc-500 flex justify-between">
            <span>
              No account?{" "}
              <Link className="text-blue-300 hover:underline" to="/register">
                Signup
              </Link>
            </span>

            <Link className="text-zinc-400 hover:underline" to="/auth">
              Back
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}