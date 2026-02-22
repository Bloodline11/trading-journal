import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Link, useNavigate } from "react-router-dom";

const REQUIRED_CODE = "ShadowDaBest";

export default function Register() {
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!name.trim()) return setErr("Name is required.");
    if (!email.trim()) return setErr("Email is required.");
    if (!pw) return setErr("Password is required.");
    if (pw !== pw2) return setErr("Passwords do not match.");
    if (code.trim() !== REQUIRED_CODE) return setErr("Invalid entry code.");

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pw,
      options: {
        data: { name: name.trim() }, // store name in user_metadata (no schema change)
      },
    });

    setLoading(false);

    if (error) {
      setErr(error.message || "Signup failed");
      return;
    }

    // If email confirmation is on, user may need to confirm.
    nav("/login");
  }

  return (
    <div className="tx-page min-h-screen flex items-center justify-center px-4">
      <div className="tx-bg-ornament" />

      <div className="w-full max-w-xl tx-streak-border">
        <div className="relative z-10 rounded-2xl bg-zinc-950/60 border border-zinc-800 p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm font-semibold tracking-wider">
              <span style={{ color: "var(--tx-silver)" }}>Terminal</span>
              <span style={{ color: "var(--tx-blue)" }}>X</span>
            </div>
            <div className="text-xs text-zinc-500">Signup</div>
          </div>

          <h1 className="text-2xl font-semibold text-zinc-100">
            Private beta access
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Signup requires an entry code (get it from Shadow).
          </p>

          {err ? (
            <div className="tx-alert tx-alert-red mt-4">{err}</div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="tx-label">Name</label>
              <input
                className="tx-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Shadow"
                autoComplete="name"
              />
            </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="tx-label">Password</label>
                <input
                  className="tx-input"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="tx-label">Confirm password</label>
                <input
                  className="tx-input"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div>
              <label className="tx-label">Entry code</label>
              <input
                className="tx-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ask Shadow"
              />
              <div className="text-[11px] text-zinc-600 mt-1">
                Without a valid entry code, signup is blocked.
              </div>
            </div>

            <button
              type="submit"
              className="tx-btn tx-btn-primary w-full"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="mt-5 text-xs text-zinc-500 flex justify-between">
            <span>
              Already have an account?{" "}
              <Link className="text-blue-300 hover:underline" to="/login">
                Login
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