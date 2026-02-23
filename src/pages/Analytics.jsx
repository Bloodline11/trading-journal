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

/**
 * NOTE:
 * - No auth refactor.
 * - Uses trades table.
 * - "Expectancy" here = mean PnL per trade (avg PnL).
 * - Rolling chart = rolling mean PnL over last N trades.
 */

// ---- Constants / Helpers ----------------------------------------------------

const CHART = {
  grid: "#1f2937",
  axis: "#a1a1aa",
  zero: "#3f3f46",
  pos: "#1e3a8a", // charcoal blue
  neg: "#7f1d1d", // charcoal red
};

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

// ---- Stats -----------------------------------------------------------------

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

  const pf = grossLossAbs === 0 ? (grossWin > 0 ? Infinity : 0) : grossWin / grossLossAbs;

  const expectancy = n ? total / n : 0;

  // Max drawdown on cumulative equity curve
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

function rollingExpectancy(trades, window = 30) {
  if (!trades.length) return [];

  const out = [];
  let sum = 0;
  const q = [];

  for (let i = 0; i < trades.length; i++) {
    const p = Number(trades[i].pnl) || 0;
    q.push(p);
    sum += p;

    if (q.length > window) sum -= q.shift();

    const denom = q.length;
    const exp = denom ? sum / denom : 0;

    out.push({
      i: i + 1,
      exp,
      expPos: exp >= 0 ? exp : null,
      expNeg: exp < 0 ? exp : null,
    });
  }

  return out;
}

// ---- UI Components ---------------------------------------------------------

function Card({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl bg-zinc-950/60 border border-zinc-800 p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-base font-semibold text-zinc-100">{title}</div>
        {subtitle ? <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

function StatTile({ label, value, sub, valueClass = "text-zinc-100" }) {
  return (
    <div className="rounded-2xl bg-zinc-950/40 border border-zinc-800 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-lg font-semibold tabular-nums mt-1 ${valueClass}`}>{value}</div>
      {sub ? <div className="text-[11px] text-zinc-600 mt-1">{sub}</div> : null}
    </div>
  );
}

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.value;
  const v = Number(p);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/95 px-3 py-2 shadow-lg">
      <div className="text-[11px] text-zinc-500 mb-1">#{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${pnlTextClass(v)}`}>${fmtMoney(v)}</div>
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

function PnLCalendar({ trades }) {
  // Default: current month (UTC)
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth()); // 0-11

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
    const m = month - 1;
    if (m < 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth(m);
    }
  };

  const navNext = () => {
    const m = month + 1;
    if (m > 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth(m);
    }
  };

  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">PnL Calendar</div>
          <div className="text-xs text-zinc-500 mt-0.5">
            Daily net PnL (UTC day derived from executed_at). Hover for details.
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
          {/* DOW header */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {dow.map((d) => (
              <div key={d} className="text-[11px] text-zinc-500 text-center">
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          <div className="space-y-2">
            {weeks.map((w, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-2">
                {w.map((dt, di) => {
                  if (!dt) {
                    return <div key={di} className="h-20 rounded-xl border border-zinc-900 bg-zinc-950/20" />;
                  }

                  const key = toUTCDayKey(dt);
                  const rec = dailyMap.get(key);
                  const pnl = rec ? Number(rec.pnl) || 0 : 0;
                  const count = rec ? rec.count : 0;

                  const isPos = pnl > 0;
                  const isNeg = pnl < 0;

                  const bg = isPos ? CHART.pos : isNeg ? CHART.neg : "#27272a";
                  const op = count ? 0.15 + 0.65 * intensity(pnl) : 0.08;

                  const title = `${key}\nPnL: $${fmtMoney(pnl)}\nTrades: ${count}`;

                  return (
                    <div
                      key={di}
                      title={title}
                      className="h-20 rounded-xl border border-zinc-800 p-2 flex flex-col justify-between"
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
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-2 text-[11px] text-zinc-600">
            Cell color intensity scales to the max absolute daily PnL in the current filtered sample.
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Main Page -------------------------------------------------------------

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState([]);

  // URL filters (source of truth)
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const symbol = searchParams.get("symbol") || "";
  const side = searchParams.get("side") || "";

  // Controlled inputs for filter UI
  const [uiFrom, setUiFrom] = useState(from);
  const [uiTo, setUiTo] = useState(to);
  const [uiSymbol, setUiSymbol] = useState(symbol);
  const [uiSide, setUiSide] = useState(side);

  // Keep UI inputs synced if URL changes externally
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

      // Scope to user_id and order by executed_at (chronological)
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

    // Ensure stable chronological order (executed_at primary)
    out.sort((a, b) => {
      const da = new Date(tradeTime(a)).getTime();
      const db = new Date(tradeTime(b)).getTime();
      return da - db;
    });

    return out;
  }, [trades, from, to, symbol, side]);

  const equity = useMemo(() => equitySeries(sample), [sample]);
  const daily = useMemo(() => dailyPnL(sample), [sample]);
  const rollExp = useMemo(() => rollingExpectancy(sample, 30), [sample]);
  const stats = useMemo(() => computeStats(sample), [sample]);

  const applyFilters = () => {
    const next = new URLSearchParams();

    if (uiFrom && uiFrom.trim()) next.set("from", uiFrom.trim());
    if (uiTo && uiTo.trim()) next.set("to", uiTo.trim());
    if (uiSymbol && uiSymbol.trim()) next.set("symbol", uiSymbol.trim().toUpperCase());
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

  if (loading) return <div className="p-6 text-sm text-zinc-400">Loading analytics…</div>;

  return (
    <div className="p-5 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-zinc-100">Analytics</div>
          <div className="text-xs text-zinc-500 mt-1">Filters drive all charts on this page.</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {from ? <FilterPill label="from" value={from} /> : null}
          {to ? <FilterPill label="to" value={to} /> : null}
          {symbol ? <FilterPill label="symbol" value={symbol} /> : null}
          {side ? <FilterPill label="side" value={side} /> : null}
          <FilterPill label="trades" value={String(stats.n)} />
        </div>
      </div>

      {/* FILTER BAR (functional) */}
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
              placeholder="MNQ"
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
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
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
              Clear
            </button>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-zinc-600">
          Date filters use <span className="text-zinc-300">executed_at</span> (fallback: created_at for legacy).
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatTile
          label="Total PnL"
          value={`$${fmtMoney(stats.total)}`}
          valueClass={pnlTextClass(stats.total)}
          sub="sum pnl over filtered sample"
        />
        <StatTile
          label="Profit Factor"
          value={stats.pf === Infinity ? "∞" : String(stats.pf)}
          sub="gross wins / abs(gross losses)"
        />
        <StatTile
          label="Avg PnL / Trade (Expectancy)"
          value={`$${fmtMoney(stats.expectancy)}`}
          valueClass={pnlTextClass(stats.expectancy)}
          sub="mean pnl per trade"
        />
        <StatTile
          label="Max Drawdown"
          value={`$${fmtMoney(stats.maxDD)}`}
          valueClass={pnlTextClass(-stats.maxDD)}
          sub="peak-to-trough equity drawdown"
        />
      </div>

      {/* Equity Curve */}
      <Card title="Equity Curve" subtitle="Cumulative PnL over time.">
        <div className="h-[280px]">
          {equity.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">
              No trades for current filters.
            </div>
          ) : (
            <ResponsiveContainer>
              <AreaChart data={equity}>
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                <XAxis dataKey="i" tick={{ fill: CHART.axis, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: "transparent" }} />
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

      {/* Rolling Expectancy */}
      <Card
        title="Rolling 30-Trade Avg PnL (Expectancy)"
        subtitle="Edge stability monitor: rolling mean PnL over the last 30 trades."
      >
        <div className="h-[280px]">
          {rollExp.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">
              No trades for current filters.
            </div>
          ) : (
            <ResponsiveContainer>
              <LineChart data={rollExp}>
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                <XAxis dataKey="i" tick={{ fill: CHART.axis, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: "transparent" }} />
                <ReferenceLine y={0} stroke={CHART.zero} />
                <Line
                  type="monotone"
                  dataKey="expPos"
                  name="Avg PnL +"
                  stroke={CHART.pos}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="expNeg"
                  name="Avg PnL -"
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

      {/* Daily PnL (used later for calendar too) */}
      <Card title="PnL Calendar" subtitle="Daily net PnL calendar. Hover a day for details.">
  <PnLCalendar trades={sample} />
</Card>
    </div>
  );
}
// ---- Calendar Helpers ------------------------------------------------------

function getMonthMatrix(year, month) {
  // month: 0-11
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));

  const startDay = first.getUTCDay(); // 0=Sun
  const totalDays = last.getUTCDate();

  const weeks = [];
  let currentWeek = [];

  // pad leading empty cells
  for (let i = 0; i < startDay; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dt = new Date(Date.UTC(year, month, day));
    currentWeek.push(dt);

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // pad trailing
  while (currentWeek.length && currentWeek.length < 7) {
    currentWeek.push(null);
  }

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