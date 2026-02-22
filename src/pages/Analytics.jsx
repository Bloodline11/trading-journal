console.log("THIS IS THE ANALYTICS FILE RUNNING");
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
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

/**
 * NOTE:
 * - This page intentionally avoids refactoring auth or schema.
 * - Uses existing trades table + existing logic.
 * - "Expectancy" in this implementation is mean PnL per trade (avg PnL),
 *   and the rolling chart is rolling mean PnL over the last N trades.
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
  // YYYY-MM-DD in UTC
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekdayNameUTC(dt) {
  // 0=Sun..6=Sat
  const idx = dt.getUTCDay();
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][idx] || "NA";
}

function hourUTC(dt) {
  return dt.getUTCHours();
}

function safeDate(dt) {
  const t = dt?.getTime?.();
  return Number.isFinite(t) ? dt : null;
}

// ---- Stats ---------------------------------------------------------------

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
  const grossLossAbs = Math.abs(losses.reduce((a, b) => a + b, 0)); // abs sum losses

  const pf = grossLossAbs === 0 ? (grossWin > 0 ? Infinity : 0) : grossWin / grossLossAbs;

  // "Expectancy" here = mean pnl per trade over the current filtered sample.
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
  const avgLossAbs = lossCount ? Math.abs(losses.reduce((a, b) => a + b, 0)) / lossCount : 0;

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
  // returns [{i, equity, equityPos, equityNeg}]
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
    const dt = safeDate(new Date(t.entry_time || t.created_at || t.date || t.timestamp));
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

function avgByWeekday(trades) {
  const sums = new Map(); // weekday -> sum
  const counts = new Map(); // weekday -> count
  for (const t of trades) {
    const dt = safeDate(new Date(t.entry_time || t.created_at || t.date || t.timestamp));
    if (!dt) continue;
    const wd = weekdayNameUTC(dt);
    sums.set(wd, (sums.get(wd) || 0) + (Number(t.pnl) || 0));
    counts.set(wd, (counts.get(wd) || 0) + 1);
  }
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return order.map((wd) => {
    const c = counts.get(wd) || 0;
    const s = sums.get(wd) || 0;
    const v = c ? s / c : 0;
    return {
      wd,
      avg: v,
      avgPos: v >= 0 ? v : null,
      avgNeg: v < 0 ? v : null,
      n: c,
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

function buildPnLHeatmap(trades) {
  // avg pnl per trade by weekday x hour (UTC)
  // data: rows (weekday) with 24 hours
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const sums = new Map(); // key = wd|h -> sum
  const counts = new Map(); // key = wd|h -> count

  for (const t of trades) {
    const dt = safeDate(new Date(t.entry_time || t.created_at || t.date || t.timestamp));
    if (!dt) continue;
    const wd = weekdayNameUTC(dt);
    const h = hourUTC(dt);
    const key = `${wd}|${h}`;
    sums.set(key, (sums.get(key) || 0) + (Number(t.pnl) || 0));
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  let maxAbs = 0;
  const rows = weekdays.map((wd) => {
    const hours = Array.from({ length: 24 }, (_, h) => {
      const key = `${wd}|${h}`;
      const c = counts.get(key) || 0;
      const s = sums.get(key) || 0;
      const avg = c ? s / c : 0;
      maxAbs = Math.max(maxAbs, Math.abs(avg));
      return { h, avg, n: c };
    });
    return { wd, hours };
  });

  return { rows, maxAbs };
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

function SectionHeader({ title, right }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2">
      <div className="text-sm font-semibold text-zinc-100">{title}</div>
      {right ? <div className="text-xs text-zinc-500">{right}</div> : null}
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

// ---- Main Page -------------------------------------------------------------

export default function Analytics() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState([]);

  // URL filters (as per thread-state export)
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const symbol = searchParams.get("symbol") || "";
  const asset = searchParams.get("asset") || "";
  const side = searchParams.get("side") || "";

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("trades")
        .select("*")
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

    // Filter by date range if provided (assumes entry_time is ISO or timestamp)
    const fromDt = parseISODate(from);
    const toDt = parseISODate(to);

    if (fromDt) {
      out = out.filter((t) => {
        const dt = safeDate(new Date(t.entry_time || t.created_at || t.date || t.timestamp));
        return dt ? dt.getTime() >= fromDt.getTime() : false;
      });
    }

    if (toDt) {
      // inclusive to end of day UTC
      const end = new Date(toDt.getTime() + 24 * 60 * 60 * 1000 - 1);
      out = out.filter((t) => {
        const dt = safeDate(new Date(t.entry_time || t.created_at || t.date || t.timestamp));
        return dt ? dt.getTime() <= end.getTime() : false;
      });
    }

    if (symbol) {
      const s = symbol.trim().toLowerCase();
      out = out.filter((t) => String(t.symbol || "").toLowerCase() === s);
    }

    if (asset) {
      const a = asset.trim().toLowerCase();
      out = out.filter((t) => String(t.asset || "").toLowerCase() === a);
    }

    if (side) {
      const sd = side.trim().toLowerCase();
      out = out.filter((t) => String(t.side || "").toLowerCase() === sd);
    }

    // Ensure stable chronological order for equity + rolling
    out.sort((a, b) => {
      const da = new Date(a.entry_time || a.created_at || a.date || a.timestamp).getTime();
      const db = new Date(b.entry_time || b.created_at || b.date || b.timestamp).getTime();
      return da - db;
    });

    return out;
  }, [trades, from, to, symbol, asset, side]);

  const equity = useMemo(() => equitySeries(sample), [sample]);
  const daily = useMemo(() => dailyPnL(sample), [sample]);
  const weekdayAvg = useMemo(() => avgByWeekday(sample), [sample]);
  const rollExp = useMemo(() => rollingExpectancy(sample, 30), [sample]);
  const heat = useMemo(() => buildPnLHeatmap(sample), [sample]);
  const stats = useMemo(() => computeStats(sample), [sample]);

  if (loading) return <div className="p-6 text-sm text-zinc-400">Loading analytics…</div>;

  return (
    <div className="p-5 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-zinc-100">Analytics</div>
          <div className="text-xs text-zinc-500 mt-1">
            //: <span className="text-zinc-300">from</span>, <span className="text-zinc-300">to</span>,{" "}
            <span className="text-zinc-300">symbol</span>, <span className="text-zinc-300">asset</span>,{" "}
            <span className="text-zinc-300">side</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {from ? <FilterPill label="from" value={from} /> : null}
          {to ? <FilterPill label="to" value={to} /> : null}
          {symbol ? <FilterPill label="symbol" value={symbol} /> : null}
          {asset ? <FilterPill label="asset" value={asset} /> : null}
          {side ? <FilterPill label="side" value={side} /> : null}
          <FilterPill label="trades" value={String(stats.n)} />
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
      <Card title="Equity Curve" subtitle="Cumulative PnL over time .">
        <div className="h-[280px]">
          {equity.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">No trades for current filters.</div>
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
      <Card title="Rolling 30-Trade Avg PnL (Expectancy)" subtitle="Edge stability monitor: rolling mean PnL over the last 30 trades.">
        <div className="h-[280px]">
          {rollExp.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">No trades for current filters.</div>
          ) : (
            <ResponsiveContainer>
              <LineChart data={rollExp}>
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                <XAxis dataKey="i" tick={{ fill: CHART.axis, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: "transparent" }} />
                <ReferenceLine y={0} stroke={CHART.zero} />
                <Line type="monotone" dataKey="expPos" name="Avg PnL +" stroke={CHART.pos} strokeWidth={2} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="expNeg" name="Avg PnL -" stroke={CHART.neg} strokeWidth={2} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      
    </div>
  );
}

function Heatmap({ heat }) {
  const { rows, maxAbs } = heat;
  const scale = (v) => {
    if (!maxAbs) return 0;
    return clamp(Math.abs(v) / maxAbs, 0, 1);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-zinc-500">
        
          <span className="font-semibold text-zinc-200 tabular-nums">${fmtMoney(maxAbs)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="tabular-nums">0</span>
          <div className="h-2 w-28 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full w-1/2 inline-block"
              style={{
                background: `linear-gradient(to right, ${CHART.pos}, ${CHART.pos})`,
                opacity: 0.25,
              }}
            />
            <div
              className="h-full w-1/2 inline-block"
              style={{
                background: `linear-gradient(to right, ${CHART.neg}, ${CHART.neg})`,
                opacity: 0.25,
              }}
            />
          </div>
          <span className="tabular-nums">{fmtMoney(maxAbs)}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[880px]">
          <div className="grid grid-cols-[80px_repeat(24,minmax(0,1fr))] gap-1 text-[11px] text-zinc-600 mb-2">
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="text-center tabular-nums">
                {String(h).padStart(2, "0")}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            {rows.map((r) => (
              <div key={r.wd} className="grid grid-cols-[80px_repeat(24,minmax(0,1fr))] gap-1">
                <div className="text-[11px] text-zinc-500 flex items-center">{r.wd}</div>
                {r.hours.map((cell) => {
                  const a = cell.avg;
                  const intensity = scale(a);
                  const isPos = a >= 0;
                  const bg = isPos ? CHART.pos : CHART.neg;

                  return (
                    <div
                      key={cell.h}
                      title={`${r.wd} ${String(cell.h).padStart(2, "0")}:00 • avg=$${fmtMoney(a)} • n=${cell.n}`}
                      className="h-7 rounded-md border border-zinc-800"
                      style={{
                        backgroundColor: bg,
                        opacity: cell.n ? 0.15 + 0.55 * intensity : 0.08,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-2 text-[11px] text-zinc-600">
            Tip: hover a cell for its avg PnL and sample size.
          </div>
        </div>
      </div>
    </div>
  );
}