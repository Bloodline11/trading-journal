// src/pages/AddTrade.jsx
import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

function toNumOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toExecutedAtISO(dateStr, timeStr) {
  // dateStr: "YYYY-MM-DD", timeStr: "HH:MM"
  // Construct a local time Date, then convert to ISO (UTC) for timestamptz.
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const local = new Date(y, m - 1, d, hh, mm, 0, 0);
  return local.toISOString();
}

export default function AddTrade() {
  const navigate = useNavigate();

  const [market, setMarket] = useState("FUTURES"); // UI-only (not stored yet)
  const [symbol, setSymbol] = useState("MNQ");
  const [side, setSide] = useState("LONG");

  // NEW: executed date/time (user-selected)
  const [executedDate, setExecutedDate] = useState(() =>
    new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  );
  const [executedTime, setExecutedTime] = useState(() => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`; // HH:MM
  });

  // Optional fields
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [size, setSize] = useState("");

  // REQUIRED: user-entered PnL
  const [pnlInput, setPnlInput] = useState("");

  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const entry = useMemo(() => toNumOrNull(entryPrice), [entryPrice]);
  const exit = useMemo(() => toNumOrNull(exitPrice), [exitPrice]);
  const qty = useMemo(() => toNumOrNull(size), [size]);
  const pnl = useMemo(() => toNumOrNull(pnlInput), [pnlInput]);

  const canSave = useMemo(() => {
    if (!symbol || symbol.trim().length === 0) return false;
    if (!side) return false;
    // PnL required and must be numeric (can be negative or zero)
    if (pnl === null) return false;

    // executed date/time required
    if (!executedDate || executedDate.trim().length === 0) return false;
    if (!executedTime || executedTime.trim().length === 0) return false;

    return true;
  }, [symbol, side, pnl, executedDate, executedTime]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");

    if (!canSave) {
      setError("Symbol, Executed Date/Time, and PnL are required. PnL must be a valid number.");
      return;
    }

    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;

    if (!user) {
      setSaving(false);
      setError("No user session. Please log in again.");
      return;
    }

    let executedAtISO;
    try {
      executedAtISO = toExecutedAtISO(executedDate, executedTime);
      if (!executedAtISO || Number.isNaN(Date.parse(executedAtISO))) {
        throw new Error("Invalid executed date/time.");
      }
    } catch {
      setSaving(false);
      setError("Invalid Executed Date/Time. Please re-select and try again.");
      return;
    }

    const payload = {
      user_id: user.id,
      symbol: symbol.trim().toUpperCase(),
      side,
      executed_at: executedAtISO, // ✅ new column
      entry_price: entry, // optional
      exit_price: exit, // optional
      size: qty, // optional
      pnl: pnl, // ✅ manual input (source of truth)
      notes: notes.trim(),
    };

    const { error: insertError } = await supabase.from("trades").insert([payload]);

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    navigate("/trades");
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">New Trade</h1>
          <p className="text-sm text-zinc-400">
            PnL is entered manually. Entry/Exit are optional.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/trades")}
          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm hover:bg-zinc-900"
        >
          Back
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Entry panel */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-900 bg-zinc-950 p-5">
          <h2 className="text-sm font-semibold text-zinc-200">Trade Entry</h2>

          <form onSubmit={handleSave} className="mt-4 space-y-4">
            {/* Market (UI only) + Symbol */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm text-zinc-300">Market</label>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2"
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                >
                  <option value="FUTURES">Futures</option>
                  <option value="OPTIONS">Options</option>
                  <option value="STOCKS">Stocks</option>
                </select>
                <p className="mt-1 text-xs text-zinc-500">
                  (Not stored yet — schema limitation in current phase)
                </p>
              </div>

              <div>
                <label className="text-sm text-zinc-300">Symbol</label>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="MNQ / AAPL / SPY 450C"
                  required
                />
              </div>
            </div>

            {/* Side + PnL */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm text-zinc-300">Side</label>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2"
                  value={side}
                  onChange={(e) => setSide(e.target.value)}
                >
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-zinc-300">PnL ($) — required</label>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2"
                  value={pnlInput}
                  onChange={(e) => setPnlInput(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 125.50 or -80"
                  required
                />
                <p className="mt-1 text-xs text-zinc-500">Enter the final realized PnL for this trade.</p>
              </div>
            </div>

            {/* Executed date/time */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm text-zinc-300">Executed Date</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2"
                  value={executedDate}
                  onChange={(e) => setExecutedDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-sm text-zinc-300">Executed Time</label>
                <input
                  type="time"
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2"
                  value={executedTime}
                  onChange={(e) => setExecutedTime(e.target.value)}
                  required
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Stored as timestamptz in Supabase (your local time converted to UTC).
                </p>
              </div>
            </div>

            {/* Optional: entry/exit/size */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="text-sm text-zinc-300">Entry Price (optional)</label>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 17850.25"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-300">Exit Price (optional)</label>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 17870.00"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-300">Contracts / Shares (optional)</label>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 1"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm text-zinc-300">Notes</label>
              <textarea
                className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2"
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context, plan, execution notes..."
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              disabled={saving || !canSave}
              className="w-full rounded-md bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Trade"}
            </button>
          </form>
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5">
          <h2 className="text-sm font-semibold text-zinc-200">Summary</h2>

          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-zinc-900 bg-zinc-900/30 p-3">
              <div className="text-xs text-zinc-400">PnL ($)</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {pnl === null ? "—" : pnl.toFixed(2)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-zinc-900 bg-zinc-900/30 p-3">
                <div className="text-xs text-zinc-400">Market</div>
                <div className="mt-1 font-semibold">{market}</div>
              </div>

              <div className="rounded-lg border border-zinc-900 bg-zinc-900/30 p-3">
                <div className="text-xs text-zinc-400">Side</div>
                <div className="mt-1 font-semibold">{side}</div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-900 bg-zinc-900/30 p-3">
              <div className="text-xs text-zinc-400">Entry / Exit</div>
              <div className="mt-1 text-sm text-zinc-200 tabular-nums">
                {entry === null ? "—" : entry} <span className="text-zinc-500">→</span>{" "}
                {exit === null ? "—" : exit}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-900 bg-zinc-900/30 p-3">
              <div className="text-xs text-zinc-400">Executed</div>
              <div className="mt-1 text-sm text-zinc-200 tabular-nums">
                {executedDate} {executedTime}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}