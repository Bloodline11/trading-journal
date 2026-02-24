// src/pages/Analytics.jsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

// ---- Styling constants ------------------------------------------------------

const CHART = {
  grid: "#1f2937",
  axis: "#a1a1aa",
  zero: "#3f3f46",
  pos: "#1e3a8a",
  neg: "#7f1d1d",
  band: "#52525b",
};

// ---- Helpers ----------------------------------------------------------------

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

function pnlTextClass(v) {
  const x = Number(v) || 0;
  if (x > 0) return "text-blue-300";
  if (x < 0) return "text-red-300";
  return "text-zinc-200";
}

function parseISODate(s) {
  // Accept YYYY-MM-DD
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d, 0, 0, 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toUTCDayKey(dt) {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function safeDate(dt) {
  const t = dt?.getTime?.();
  return Number.isFinite(t) ? dt : null;
}

function tradeTime(t) {
  // Primary timestamp is executed_at; fallback to created_at for legacy
  return t?.executed_at || t?.created_at || t?.date || t?.timestamp;
}

function fmtUTCTime(iso) {
  const dt = safeDate(new Date(iso));
  if (!dt) return "—";
  const hh = String(dt.getUTCHours()).padStart(2, "0");
  const mm = String(dt.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

// ---- Stats ------------------------------------------------------------------

function computeStats(trades) {
  const pnls = trades.map((t) => Number(t.pnl) || 0);

  const total = pnls.reduce((a, b) => a + b, 0);

  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const breakeven = pnls.filter((p) => p === 0);

  const winCount = wins.length;
  const lossCount = losses.length;
  const beCount = breakeven.length;
  const n = pnls.length;

  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLossAbs = Math.abs(losses.reduce((a, b) => a + b, 0));

  const pf =
    grossLossAbs === 0 ? (grossWin > 0 ? Infinity : 0) : grossWin / grossLossAbs;

  const expectancy = n ? total / n : 0;

  // Max drawdown on cumulative equity curve (performance curve from 0)
  let peak = 0;
  let eq = 0;
  let maxDD = 0;
  for (const p of pnls) {
    eq += p;
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    if (dd > maxDD) maxDD = dd;
  }

  const avgWin = winCount ? grossWin / winCount : 0;
  const avgLossAbs = lossCount ? grossLossAbs / lossCount : 0;
  const winRate = n ? winCount / n : 0;

  return {
    n,
    total,
    winCount,
    lossCount,
    beCount,
    winRate,
    grossWin,
    grossLossAbs,
    pf,
    expectancy,
    maxDD,
    avgWin,
    avgLossAbs,
  };
}

function equitySeries(trades) {
  let eq = 0;
  const out = [];
  for (let i = 0; i < trades.length; i++) {
    const p = Number(trades[i].pnl) || 0;
    eq += p;
    out.push({
      i: i + 1,
      equity: eq,
      equityPos: eq >= 0 ? eq : null,
      equityNeg: eq < 0 ? eq : null,
    });
  }
  return out;
}

function dailyPnL(trades) {
  const map = new Map(); // dayKey -> pnl
  for (const t of trades) {
    const dt = safeDate(new Date(tradeTime(t)));
    if (!dt) continue;
    const key = toUTCDayKey(dt);
    map.set(key, (map.get(key) || 0) + (Number(t.pnl) || 0));
  }
  const keys = Array.from(map.keys()).sort();
  return keys.map((k, idx) => {
    const v = map.get(k) || 0;
    return {
      i: idx + 1,
      day: k,
      pnl: v,
      pnlPos: v >= 0 ? v : null,
      pnlNeg: v < 0 ? v : null,
    };
  });
}

/**
 * Rolling Expectancy with Confidence Bands
 * mean ± 2*SE, SE = stdev / sqrt(n)
 */
function rollingExpectancyWithBands(trades, window = 30) {
  if (!trades.length) return [];

  const out = [];
  const q = [];
  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < trades.length; i++) {
    const p = Number(trades[i].pnl) || 0;

    q.push(p);
    sum += p;
    sumSq += p * p;

    if (q.length > window) {
      const removed = q.shift();
      sum -= removed;
      sumSq -= removed * removed;
    }

    const n = q.length;
    const mean = n ? sum / n : 0;

    let variance = 0;
    if (n > 1) {
      const numer = sumSq - (sum * sum) / n;
      variance = numer > 0 ? numer / (n - 1) : 0;
    }

    const stdev = Math.sqrt(variance);
    const se = n ? stdev / Math.sqrt(n) : 0;
    const band = 2 * se;

    out.push({
      i: i + 1,
      n,
      mean,
      meanPos: mean >= 0 ? mean : null,
      meanNeg: mean < 0 ? mean : null,
      upper: mean + band,
      lower: mean - band,
      se,
    });
  }

  return out;
}

// ---- Calendar helpers -------------------------------------------------------

function getMonthMatrix(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));

  const startDay = first.getUTCDay(); // 0=Sun
  const totalDays = last.getUTCDate();

  const weeks = [];
  let currentWeek = [];

  for (let i = 0; i < startDay; i++) currentWeek.push(null);

  for (let day = 1; day <= totalDays; day++) {
    const dt = new Date(Date.UTC(year, month, day));
    currentWeek.push(dt);

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  while (currentWeek.length && currentWeek.length < 7) currentWeek.push(null);
  if (currentWeek.length) weeks.push(currentWeek);

  return weeks;
}

function buildDailyMap(trades) {
  const map = new Map(); // YYYY-MM-DD -> { pnl, count }
  for (const t of trades) {
    const dt = safeDate(new Date(tradeTime(t)));
    if (!dt) continue;

    const key = toUTCDayKey(dt);
    const prev = map.get(key) || { pnl: 0, count: 0 };

    map.set(key, {
      pnl: prev.pnl + (Number(t.pnl) || 0),
      count: prev.count + 1,
    });
  }
  return map;
}

function tradesForDayUTC(trades, dayKey) {
  if (!dayKey) return [];
  const out = [];

  for (const t of trades) {
    const dt = safeDate(new Date(tradeTime(t)));
    if (!dt) continue;
    if (toUTCDayKey(dt) === dayKey) out.push(t);
  }

  out.sort((a, b) => {
    const da = new Date(tradeTime(a)).getTime();
    const db = new Date(tradeTime(b)).getTime();
    return da - db;
  });

  return out;
}

// ---- UI components ----------------------------------------------------------

function Card({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl bg-zinc-950/60 border border-zinc-800 p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-base font-semibold text-zinc-100">{title}</div>
        {subtitle ? (
          <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function StatTile({ label, value, sub, valueClass = "text-zinc-100" }) {
  return (
    <div className="rounded-2xl bg-zinc-950/40 border border-zinc-800 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-lg font-semibold tabular-nums mt-1 ${valueClass}`}>
        {value}
      </div>
      {sub ? <div className="text-[11px] text-zinc-600 mt-1">{sub}</div> : null}
    </div>
  );
}

function EquityTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const v = Number(payload[0]?.value || 0);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/95 px-3 py-2 shadow-lg">
      <div className="text-[11px] text-zinc-500 mb-1">Trade #{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${pnlTextClass(v)}`}>
        ${fmtMoney(v)}
      </div>
    </div>
  );
}

function RollingBandsTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  const mean = Number(row.mean) || 0;
  const upper = Number(row.upper) || 0;
  const lower = Number(row.lower) || 0;
  const n = Number(row.n) || 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/95 px-3 py-2 shadow-lg">
      <div className="text-[11px] text-zinc-500 mb-1">
        Trade #{label} • Based on last {n} trades
      </div>
      <div className={`text-sm font-semibold tabular-nums ${pnlTextClass(mean)}`}>
        Average: ${fmtMoney(mean)} / trade
      </div>
      <div className="text-[12px] text-zinc-300 tabular-nums mt-1">
        Confidence range: ${fmtMoney(lower)} → ${fmtMoney(upper)}
      </div>
      <div className="text-[11px] text-zinc-500 mt-1">
        Narrow range = more consistent. Wide range = more variable.
      </div>
    </div>
  );
}

function FilterPill({ label, value }) {
  return (
    <div className="px-2 py-1 rounded-full border border-zinc-800 bg-zinc-950/40 text-xs text-zinc-400">
      <span className="text-zinc-500">{label}: </span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}

function DayTradesPanel({ dayKey, dayTrades, onClear }) {
  if (!dayKey) return null;

  const dayTotal = dayTrades.reduce((a, t) => a + (Number(t.pnl) || 0), 0);

  return (
    <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-zinc-100">
            Trades on {dayKey}
          </div>
          <div className="text-[11px] text-zinc-600 mt-0.5">
            Showing trades from this date (times displayed in UTC).
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-400">
            Day total:{" "}
            <span className={`tabular-nums ${pnlTextClass(dayTotal)}`}>
              ${fmtMoney(dayTotal)}
            </span>
            {"  "}•{" "}
            <span className="text-zinc-200 tabular-nums">{dayTrades.length}</span>{" "}
            trades
          </div>

          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
          >
            Clear
          </button>
        </div>
      </div>

      {dayTrades.length === 0 ? (
        <div className="mt-3 text-sm text-zinc-500">No trades recorded for this day.</div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead>
              <tr className="text-[11px] text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-2 pr-3 font-medium">Time</th>
                <th className="text-left py-2 pr-3 font-medium">Symbol</th>
                <th className="text-left py-2 pr-3 font-medium">Side</th>
                <th className="text-right py-2 pr-3 font-medium">PnL</th>
                <th className="text-right py-2 pr-3 font-medium">Size</th>
                <th className="text-right py-2 pr-3 font-medium">Entry</th>
                <th className="text-right py-2 pr-3 font-medium">Exit</th>
                <th className="text-left py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {dayTrades.map((t) => {
                const pnl = Number(t.pnl) || 0;
                const time = fmtUTCTime(tradeTime(t));
                const sym = String(t.symbol || "—");
                const side = String(t.side || "—").toUpperCase();
                const size = t.size ?? "";
                const entry = t.entry_price ?? "";
                const exit = t.exit_price ?? "";
                const notes = String(t.notes || "");

                return (
                  <tr key={t.id || `${sym}-${time}-${pnl}`} className="border-b border-zinc-900/80">
                    <td className="py-2 pr-3 text-zinc-300 tabular-nums">{time}</td>
                    <td className="py-2 pr-3 text-zinc-200">{sym}</td>
                    <td className="py-2 pr-3 text-zinc-300">{side}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${pnlTextClass(pnl)}`}>
                      ${fmtMoney(pnl)}
                    </td>
                    <td className="py-2 pr-3 text-right text-zinc-300 tabular-nums">
                      {size === "" ? "—" : size}
                    </td>
                    <td className="py-2 pr-3 text-right text-zinc-300 tabular-nums">
                      {entry === "" ? "—" : entry}
                    </td>
                    <td className="py-2 pr-3 text-right text-zinc-300 tabular-nums">
                      {exit === "" ? "—" : exit}
                    </td>
                    <td className="py-2 text-zinc-400">
                      {notes ? (
                        <span title={notes}>
                          {notes.length > 40 ? notes.slice(0, 40) + "…" : notes}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PnLCalendar({ trades }) {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth()); // 0-11
  const [selectedDayKey, setSelectedDayKey] = useState("");

  const dailyMap = useMemo(() => buildDailyMap(trades), [trades]);

  const maxAbs = useMemo(() => {
    let m = 0;
    for (const v of dailyMap.values()) {
      m = Math.max(m, Math.abs(Number(v.pnl) || 0));
    }
    return m;
  }, [dailyMap]);

  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month]);

  const monthLabel = useMemo(() => {
    const d = new Date(Date.UTC(year, month, 1));
    return d.toLocaleString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  }, [year, month]);

  const intensity = (pnl) => {
    if (!maxAbs) return 0;
    return clamp(Math.abs(pnl) / maxAbs, 0, 1);
  };

  const navPrev = () => {
    setSelectedDayKey("");
    const m = month - 1;
    if (m < 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth(m);
  };

  const navNext = () => {
    setSelectedDayKey("");
    const m = month + 1;
    if (m > 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth(m);
  };

  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const selectedTrades = useMemo(() => tradesForDayUTC(trades, selectedDayKey), [trades, selectedDayKey]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-zinc-500">
            Daily results view. Click any day to review trades.
          </div>
          <div className="mt-1 text-[11px] text-zinc-600">
            Trades in current view:{" "}
            <span className="text-zinc-200 tabular-nums">{trades.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={navPrev}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            aria-label="Previous month"
          >
            ←
          </button>

          <div className="text-sm text-zinc-200 tabular-nums min-w-[160px] text-center">
            {monthLabel}
          </div>

          <button
            type="button"
            onClick={navNext}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {dow.map((d) => (
              <div key={d} className="text-[11px] text-zinc-500 text-center">
                {d}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {weeks.map((w, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-2">
                {w.map((dt, di) => {
                  if (!dt) {
                    return (
                      <div
                        key={di}
                        className="h-20 rounded-xl border border-zinc-900 bg-zinc-950/20"
                      />
                    );
                  }

                  const key = toUTCDayKey(dt);
                  const rec = dailyMap.get(key);
                  const pnl = rec ? Number(rec.pnl) || 0 : 0;
                  const count = rec ? rec.count : 0;

                  const isPos = pnl > 0;
                  const isNeg = pnl < 0;

                  const bg = isPos ? CHART.pos : isNeg ? CHART.neg : "#27272a";
                  const op = count ? 0.15 + 0.65 * intensity(pnl) : 0.08;

                  const isSelected = selectedDayKey === key;

                  return (
                    <button
                      key={di}
                      type="button"
                      title={`${key}\nPnL: $${fmtMoney(pnl)}\nTrades: ${count}`}
                      onClick={() => setSelectedDayKey(key)}
                      className={[
                        "h-20 rounded-xl border p-2 flex flex-col justify-between text-left",
                        "hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500/40",
                        isSelected ? "border-zinc-200" : "border-zinc-800",
                      ].join(" ")}
                      style={{ backgroundColor: bg, opacity: op }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] text-zinc-100 tabular-nums">
                          {dt.getUTCDate()}
                        </div>
                        {count ? (
                          <div className="text-[10px] text-zinc-200/80 tabular-nums">
                            {count}
                          </div>
                        ) : null}
                      </div>

                      <div className={`text-xs font-semibold tabular-nums ${pnlTextClass(pnl)}`}>
                        {count ? `$${fmtMoney(pnl)}` : "—"}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-2 text-[11px] text-zinc-600">
            Darker intensity means a larger win/loss day (relative to this month’s results).
          </div>

          <DayTradesPanel
            dayKey={selectedDayKey}
            dayTrades={selectedTrades}
            onClear={() => setSelectedDayKey("")}
          />
        </div>
      </div>
    </div>
  );
}

// ---- Main page --------------------------------------------------------------

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState([]);

  // URL filters (source of truth)
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const symbol = searchParams.get("symbol") || "";
  const side = searchParams.get("side") || "";

  // Controlled inputs
  const [uiFrom, setUiFrom] = useState(from);
  const [uiTo, setUiTo] = useState(to);
  const [uiSymbol, setUiSymbol] = useState(symbol);
  const [uiSide, setUiSide] = useState(side);

  // Rolling window selector (consumer-friendly options)
  const [edgeWindow, setEdgeWindow] = useState(30);

  useEffect(() => {
    setUiFrom(from);
    setUiTo(to);
    setUiSymbol(symbol);
    setUiSide(side);
  }, [from, to, symbol, side]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!alive) return;

      if (userError || !user) {
        console.error("Analytics: no user session", userError);
        setTrades([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .order("executed_at", { ascending: true })
        .order("created_at", { ascending: true });

      if (!alive) return;

      if (error) {
        console.error("Analytics trades load error:", error);
        alert("Analytics load failed. Check console.");
        setTrades([]);
        setLoading(false);
        return;
      }

      setTrades(data || []);
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const sample = useMemo(() => {
    let out = [...trades];

    const fromDt = parseISODate(from);
    const toDt = parseISODate(to);

    if (fromDt) {
      out = out.filter((t) => {
        const dt = safeDate(new Date(tradeTime(t)));
        return dt ? dt.getTime() >= fromDt.getTime() : false;
      });
    }

    if (toDt) {
      const end = new Date(toDt.getTime() + 24 * 60 * 60 * 1000 - 1);
      out = out.filter((t) => {
        const dt = safeDate(new Date(tradeTime(t)));
        return dt ? dt.getTime() <= end.getTime() : false;
      });
    }

    if (symbol) {
      const s = symbol.trim().toLowerCase();
      out = out.filter((t) => String(t.symbol || "").toLowerCase() === s);
    }

    if (side) {
      const sd = side.trim().toUpperCase();
      out = out.filter((t) => String(t.side || "").toUpperCase() === sd);
    }

    out.sort((a, b) => {
      const da = new Date(tradeTime(a)).getTime();
      const db = new Date(tradeTime(b)).getTime();
      return da - db;
    });

    return out;
  }, [trades, from, to, symbol, side]);

  const stats = useMemo(() => computeStats(sample), [sample]);
  const equity = useMemo(() => equitySeries(sample), [sample]);
  const daily = useMemo(() => dailyPnL(sample), [sample]);
  const edgeSeries = useMemo(
    () => rollingExpectancyWithBands(sample, edgeWindow),
    [sample, edgeWindow]
  );

  const applyFilters = () => {
    const next = new URLSearchParams();

    if (uiFrom && uiFrom.trim()) next.set("from", uiFrom.trim());
    if (uiTo && uiTo.trim()) next.set("to", uiTo.trim());
    if (uiSymbol && uiSymbol.trim())
      next.set("symbol", uiSymbol.trim().toUpperCase());
    if (uiSide && uiSide.trim()) next.set("side", uiSide.trim().toUpperCase());

    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setUiFrom("");
    setUiTo("");
    setUiSymbol("");
    setUiSide("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  if (loading) return <div className="p-6 text-sm text-zinc-400">Loading…</div>;

  return (
    <div className="p-5 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-zinc-100">Performance Analytics</div>
          <div className="text-xs text-zinc-500 mt-1">
            Filter your trades to isolate patterns and measure performance.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {from ? <FilterPill label="From" value={from} /> : null}
          {to ? <FilterPill label="To" value={to} /> : null}
          {symbol ? <FilterPill label="Symbol" value={symbol} /> : null}
          {side ? <FilterPill label="Side" value={side} /> : null}
          <FilterPill label="Trades" value={String(stats.n)} />
          {daily.length ? <FilterPill label="Days" value={String(daily.length)} /> : null}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl bg-zinc-950/60 border border-zinc-800 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <div className="text-xs text-zinc-500">From</div>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2 text-sm"
              value={uiFrom}
              onChange={(e) => setUiFrom(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs text-zinc-500">To</div>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2 text-sm"
              value={uiTo}
              onChange={(e) => setUiTo(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs text-zinc-500">Symbol</div>
            <input
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2 text-sm"
              value={uiSymbol}
              onChange={(e) => setUiSymbol(e.target.value)}
              placeholder="e.g. MNQ"
            />
          </div>

          <div>
            <div className="text-xs text-zinc-500">Side</div>
            <select
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 p-2 text-sm"
              value={uiSide}
              onChange={(e) => setUiSide(e.target.value)}
            >
              <option value="">All</option>
              <option value="LONG">Long</option>
              <option value="SHORT">Short</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={applyFilters}
              className="w-full rounded-md bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-zinc-600">
          Tip: Use filters to evaluate one setup, one symbol, or one time period at a time.
        </div>
      </div>

      {/* Summary Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatTile
          label="Net PnL"
          value={`$${fmtMoney(stats.total)}`}
          valueClass={pnlTextClass(stats.total)}
          sub="Total profit/loss for the filtered trades"
        />
        <StatTile
          label="Profit Factor"
          value={stats.pf === Infinity ? "∞" : Number(stats.pf).toFixed(2)}
          sub="Gross wins ÷ gross losses"
        />
        <StatTile
          label="Average PnL per Trade"
          value={`$${fmtMoney(stats.expectancy)}`}
          valueClass={pnlTextClass(stats.expectancy)}
          sub="Helps estimate your trade expectancy"
        />
        <StatTile
          label="Max Drawdown"
          value={`$${fmtMoney(stats.maxDD)}`}
          valueClass={pnlTextClass(-stats.maxDD)}
          sub="Largest peak-to-trough decline"
        />
      </div>

      {/* Equity Curve */}
      <Card
        title="Equity Curve"
        subtitle="Cumulative performance over the filtered trades (ordered by executed time)."
      >
        <div className="h-[280px]">
          {equity.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">
              No trades match your current filters.
            </div>
          ) : (
            <ResponsiveContainer>
              <AreaChart data={equity}>
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                <XAxis dataKey="i" tick={{ fill: CHART.axis, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} />
                <Tooltip content={<EquityTooltip />} cursor={{ fill: "transparent" }} />
                <ReferenceLine y={0} stroke={CHART.zero} />
                <Area
                  type="monotone"
                  dataKey="equityPos"
                  name="Equity +"
                  stroke={CHART.pos}
                  fill={CHART.pos}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="equityNeg"
                  name="Equity -"
                  stroke={CHART.neg}
                  fill={CHART.neg}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Edge Confidence */}
      <Card
        title="Edge Trend"
        subtitle="Average PnL per trade with a confidence range (consistency indicator)."
      >
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div className="text-[11px] text-zinc-600">
            If the average stays above $0 and the range is tight, your edge is more stable.
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs text-zinc-500">Lookback</div>
            <select
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
              value={edgeWindow}
              onChange={(e) => setEdgeWindow(Number(e.target.value))}
            >
              <option value={10}>Last 10 trades</option>
              <option value={30}>Last 30 trades (recommended)</option>
              <option value={50}>Last 50 trades</option>
              <option value={100}>Last 100 trades</option>
            </select>
          </div>
        </div>

        <div className="h-[280px]">
          {edgeSeries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">
              No trades match your current filters.
            </div>
          ) : (
            <ResponsiveContainer>
              <LineChart data={edgeSeries}>
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                <XAxis dataKey="i" tick={{ fill: CHART.axis, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} />
                <Tooltip content={<RollingBandsTooltip />} cursor={{ fill: "transparent" }} />
                <ReferenceLine y={0} stroke={CHART.zero} />

                {/* Confidence range (dotted lines) */}
                <Line
                  type="monotone"
                  dataKey="upper"
                  name="Upper range"
                  stroke={CHART.band}
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="lower"
                  name="Lower range"
                  stroke={CHART.band}
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="4 4"
                />

                {/* Average line split pos/neg */}
                <Line
                  type="monotone"
                  dataKey="meanPos"
                  name="Average (≥ 0)"
                  stroke={CHART.pos}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="meanNeg"
                  name="Average (< 0)"
                  stroke={CHART.neg}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* PnL Calendar */}
      <Card
        title="PnL Calendar"
        subtitle="Monthly overview of daily results. Click a day to review the trades."
      >
        <PnLCalendar trades={sample} />
      </Card>
    </div>
  );
}