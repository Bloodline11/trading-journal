// src/pages/Analytics.jsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

/** ---------- Theme (charcoal + semantic PnL colors) ---------- **/
const POS = "#2B4A6F"; // charcoal blue
const NEG = "#6B2B2B"; // charcoal red

const CHART = {
  grid: "#27272a", // zinc-800-ish
  axis: "#a1a1aa", // zinc-400
  label: "#e4e4e7", // zinc-200
  tooltipBg: "#09090b", // zinc-950
  tooltipBorder: "#27272a",
  pos: POS,
  neg: NEG,
  neutral: "#71717a", // zinc-500
  zero: "#3f3f46", // zinc-700
};

function fmtMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dayKey(isoTs) {
  // YYYY-MM-DD in UTC (stable across devices/hosting)
  return new Date(isoTs).toISOString().slice(0, 10);
}

function weekdayShortUTC(isoTs) {
  const d = new Date(isoTs).getUTCDay(); // 0=Sun..6=Sat
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d];
}

function pnlTextClass(v) {
  if (v > 0) return "text-[color:var(--pos)]";
  if (v < 0) return "text-[color:var(--neg)]";
  return "text-zinc-400";
}

/** ---------- URL-backed filters (host-safe) ---------- **/
function useTradeFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    return {
      from: searchParams.get("from") || "", // YYYY-MM-DD
      to: searchParams.get("to") || "", // YYYY-MM-DD
      symbol: searchParams.get("symbol") || "",
      asset: searchParams.get("asset") || "",
      side: searchParams.get("side") || "",
    };
  }, [searchParams]);

  function setFilter(key, value) {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  function resetFilters() {
    const next = new URLSearchParams(searchParams);
    ["from", "to", "symbol", "asset", "side"].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  }

  return { filters, setFilter, resetFilters };
}

function TradeFiltersBar({ filters, setFilter, resetFilters }) {
  const input =
    "bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:border-zinc-600";
  const label = "text-[11px] uppercase tracking-wide text-zinc-500";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="flex flex-col gap-1">
          <span className={label}>From</span>
          <input
            className={input}
            type="date"
            value={filters.from}
            onChange={(e) => setFilter("from", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className={label}>To</span>
          <input
            className={input}
            type="date"
            value={filters.to}
            onChange={(e) => setFilter("to", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className={label}>Symbol</span>
          <input
            className={input}
            placeholder="MNQ, NQ, AAPL..."
            value={filters.symbol}
            onChange={(e) => setFilter("symbol", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className={label}>Market</span>
          <select
            className={input}
            value={filters.asset}
            onChange={(e) => setFilter("asset", e.target.value)}
          >
            <option value="">All</option>
            <option value="futures">Futures</option>
            <option value="options">Options</option>
            <option value="stock">Stocks</option>
            <option value="forex">Forex</option>
            <option value="crypto">Crypto</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className={label}>Side</span>
          <select
            className={input}
            value={filters.side}
            onChange={(e) => setFilter("side", e.target.value)}
          >
            <option value="">All</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={resetFilters}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors"
            type="button"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

/** ---------- Data transforms ---------- **/

function groupByDay(trades) {
  const map = new Map();
  for (const t of trades) {
    const d = dayKey(t.created_at);
    map.set(d, (map.get(d) || 0) + (Number(t.pnl) || 0));
  }
  return Array.from(map.entries())
    .map(([date, pnl]) => ({
      date,
      pnl: Number(pnl.toFixed(2)),
      pnlPos: pnl > 0 ? Number(pnl.toFixed(2)) : 0,
      pnlNeg: pnl < 0 ? Number(Math.abs(pnl).toFixed(2)) : 0,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function avgByWeekday(trades) {
  const map = new Map(); // weekday -> {sum, n}
  for (const t of trades) {
    const k = weekdayShortUTC(t.created_at);
    const obj = map.get(k) || { sum: 0, n: 0 };
    obj.sum += Number(t.pnl) || 0;
    obj.n += 1;
    map.set(k, obj);
  }

  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return order
    .filter((k) => map.has(k))
    .map((k) => {
      const { sum, n } = map.get(k);
      const avg = n ? sum / n : 0;
      return {
        day: k,
        avg: Number(avg.toFixed(2)),
        avgPos: avg > 0 ? Number(avg.toFixed(2)) : 0,
        avgNeg: avg < 0 ? Number(Math.abs(avg).toFixed(2)) : 0,
        n,
      };
    });
}

function rollingExpectancy(trades, window = 20) {
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
      exp: Number(exp.toFixed(2)),
      expPos: exp > 0 ? Number(exp.toFixed(2)) : null,
      expNeg: exp < 0 ? Number(exp.toFixed(2)) : null, // negative values for red line
    });
  }
  return out;
}

// For Max Drawdown tile only (not chart)
function drawdownSeries(trades) {
  let bal = 0;
  let peak = 0;
  const out = [];
  for (let i = 0; i < trades.length; i++) {
    bal += Number(trades[i].pnl) || 0;
    if (bal > peak) peak = bal;
    out.push({ i: i + 1, dd: Number((peak - bal).toFixed(2)) });
  }
  return out;
}

/** ---------- PnL Heatmap (weekday x hour) ---------- **/
function buildPnLHeatmap(trades) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const hours = Array.from({ length: 24 }, (_, i) => i); // 0..23

  const agg = new Map(); // `${day}|${hour}` -> {sum,n}

  for (const t of trades) {
    const pnl = Number(t.pnl) || 0;
    const dt = new Date(t.created_at);

    const dayIdxUTC = dt.getUTCDay(); // 0 Sun .. 6 Sat
    const hourUTC = dt.getUTCHours();

    const day =
      dayIdxUTC === 1
        ? "Mon"
        : dayIdxUTC === 2
        ? "Tue"
        : dayIdxUTC === 3
        ? "Wed"
        : dayIdxUTC === 4
        ? "Thu"
        : dayIdxUTC === 5
        ? "Fri"
        : null;

    if (!day) continue;

    const key = `${day}|${hourUTC}`;
    const obj = agg.get(key) || { sum: 0, n: 0 };
    obj.sum += pnl;
    obj.n += 1;
    agg.set(key, obj);
  }

  const cellMap = new Map();
  let maxAbs = 0;

  for (const day of days) {
    for (const hour of hours) {
      const key = `${day}|${hour}`;
      const obj = agg.get(key) || { sum: 0, n: 0 };
      const avg = obj.n ? obj.sum / obj.n : 0;

      maxAbs = Math.max(maxAbs, Math.abs(avg));

      cellMap.set(key, {
        day,
        hour,
        n: obj.n,
        avg: Number(avg.toFixed(2)),
      });
    }
  }

  return { days, hours, cellMap, maxAbs: Number(maxAbs.toFixed(2)) };
}

function heatColor(avg, maxAbs) {
  if (!maxAbs || maxAbs <= 0) return "transparent";

  const a = Math.min(1, Math.max(0, Math.abs(avg) / maxAbs));
  const base = avg > 0 ? POS : avg < 0 ? NEG : null;
  if (!base) return "transparent";

  const r = parseInt(base.slice(1, 3), 16);
  const g = parseInt(base.slice(3, 5), 16);
  const b = parseInt(base.slice(5, 7), 16);

  const alpha = 0.15 + 0.65 * a; // 0.15..0.80
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hourLabel(h) {
  return String(h).padStart(2, "0") + ":00";
}

/** ---------- Stats ---------- **/
function computeStats(trades) {
  const pnls = trades.map((t) => Number(t.pnl) || 0);
  const count = pnls.length;

  const total = pnls.reduce((a, b) => a + b, 0);

  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);

  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLossAbs = Math.abs(losses.reduce((a, b) => a + b, 0));

  const winRate = count ? (wins.length / count) * 100 : 0;
  const avg = count ? total / count : 0;

  const pf =
    grossLossAbs === 0 ? (grossWin > 0 ? Infinity : 0) : grossWin / grossLossAbs;

  const expectancy = avg;

  const dd = drawdownSeries(trades);
  const maxDD = dd.length ? Math.max(...dd.map((x) => x.dd)) : 0;

  return {
    count,
    total: Number(total.toFixed(2)),
    winRate: Number(winRate.toFixed(1)),
    pf: pf === Infinity ? Infinity : Number(pf.toFixed(2)),
    expectancy: Number(expectancy.toFixed(2)),
    maxDD: Number(maxDD.toFixed(2)),
  };
}

/** ---------- Tooltip (dark) ---------- **/
function DarkTooltip({ active, payload, label, formatterLabel }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="px-3 py-2 rounded-md text-xs"
      style={{
        background: CHART.tooltipBg,
        border: `1px solid ${CHART.tooltipBorder}`,
        color: CHART.label,
      }}
    >
      <div style={{ color: CHART.axis }}>
        {formatterLabel ? formatterLabel(label, payload) : label}
      </div>
      <div className="mt-1 space-y-1">
        {payload
          .filter((p) => p.dataKey && p.value != null && p.value !== 0)
          .map((p) => (
            <div key={p.dataKey} className="flex items-center justify-between gap-6">
              <span style={{ color: CHART.axis }}>{p.name || p.dataKey}</span>
              <span className="font-semibold tabular-nums">
                {typeof p.value === "number" ? `$${fmtMoney(p.value)}` : String(p.value)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

/** ---------- UI ---------- **/
function StatTile({ label, value, valueClass = "text-zinc-200", sub }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-2 text-xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-zinc-500">{sub}</div> : null}
    </div>
  );
}

function Card({ title, children, subtitle }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-3">
        <div className="text-sm font-semibold text-zinc-200">{title}</div>
        {subtitle ? <div className="text-xs text-zinc-500 mt-1">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

/** ---------- Page ---------- **/
export default function Analytics() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  const { filters, setFilter, resetFilters } = useTradeFilters();

  useEffect(() => {
    async function load() {
      // Host-safe: same behavior local or deployed. RLS must enforce user scope.
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) console.error(error);

      setTrades(data || []);
      setLoading(false);
    }
    load();
  }, []);

  // Filter sample (client-side, zero schema/auth changes)
  const sample = useMemo(() => {
    const sym = (filters.symbol || "").trim().toUpperCase();

    // UTC boundaries so your filter behaves consistently on any device.
    const fromTs = filters.from ? Date.parse(`${filters.from}T00:00:00.000Z`) : null;
    const toTs = filters.to ? Date.parse(`${filters.to}T23:59:59.999Z`) : null;

    return trades.filter((t) => {
      const ts = Date.parse(t.created_at);

      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;

      if (sym) {
        const tSym = String(t.symbol || "").toUpperCase();
        if (!tSym.includes(sym)) return false;
      }

      if (filters.asset && t.asset_type !== filters.asset) return false;

      if (filters.side) {
        const side = t.side || t.direction; // tolerate either
        if (side !== filters.side) return false;
      }

      return true;
    });
  }, [trades, filters]);

  // All analytics run off the filtered sample
  const daily = useMemo(() => groupByDay(sample), [sample]);
  const weekdayAvg = useMemo(() => avgByWeekday(sample), [sample]);
  const rollExp = useMemo(() => rollingExpectancy(sample, 20), [sample]);
  const heat = useMemo(() => buildPnLHeatmap(sample), [sample]);
  const stats = useMemo(() => computeStats(sample), [sample]);

  if (loading) return <div className="p-6 text-zinc-300">Loading...</div>;

  return (
    <div style={{ "--pos": POS, "--neg": NEG }} className="space-y-6 p-6">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold text-zinc-100">Analytics</h1>
        <div className="text-xs text-zinc-500">
          Positive = <span className="font-semibold text-[color:var(--pos)]">charcoal blue</span> •
          Negative = <span className="font-semibold text-[color:var(--neg)]">charcoal red</span>
        </div>
      </div>

      {/* Filters (URL-backed) */}
      <TradeFiltersBar filters={filters} setFilter={setFilter} resetFilters={resetFilters} />

      {/* Top Stat Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
        <StatTile label="Trades" value={`${stats.count}`} />
        <StatTile
          label="Total PnL"
          value={`$${fmtMoney(stats.total)}`}
          valueClass={pnlTextClass(stats.total)}
        />
        <StatTile label="Win Rate" value={`${stats.winRate}%`} />
        <StatTile
          label="Profit Factor"
          value={stats.pf === Infinity ? "∞" : String(stats.pf)}
          sub="gross wins / abs(gross losses)"
        />
        <StatTile
          label="Expectancy"
          value={`$${fmtMoney(stats.expectancy)}`}
          valueClass={pnlTextClass(stats.expectancy)}
          sub="mean pnl per trade"
        />
        <StatTile
          label="Max Drawdown"
          value={`$${fmtMoney(stats.maxDD)}`}
          valueClass="text-zinc-200"
          sub="from equity curve (start=0)"
        />
      </div>

      {/* Daily PnL */}
      <Card
        title="Daily PnL"
        subtitle="Sum of trade PnL grouped by day (UTC). Hover highlight is disabled."
      >
        <div className="h-[280px]">
          {daily.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">
              No trades for current filters.
            </div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={daily}>
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: CHART.axis, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: "transparent" }} />
                <ReferenceLine y={0} stroke={CHART.zero} />
                <Bar dataKey="pnlPos" name="PnL +" fill={CHART.pos} radius={[4, 4, 0, 0]} />
                <Bar dataKey="pnlNeg" name="PnL -" fill={CHART.neg} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Avg PnL by Weekday */}
      <Card title="Average PnL by Day of Week" subtitle="Mean PnL per trade grouped by weekday.">
        <div className="h-[280px]">
          {weekdayAvg.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">
              No trades for current filters.
            </div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={weekdayAvg}>
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fill: CHART.axis, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  content={
                    <DarkTooltip
                      formatterLabel={(label, payload) => {
                        const p = payload?.[0]?.payload;
                        return p ? `${label} • n=${p.n}` : label;
                      }}
                    />
                  }
                />
                <ReferenceLine y={0} stroke={CHART.zero} />
                <Bar dataKey="avgPos" name="Avg +" fill={CHART.pos} radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgNeg" name="Avg -" fill={CHART.neg} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Rolling Expectancy */}
      <Card
        title="Rolling Expectancy (20-trade window)"
        subtitle="Edge stability monitor: rolling mean PnL over the last 20 trades."
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
                  name="Expectancy +"
                  stroke={CHART.pos}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="expNeg"
                  name="Expectancy -"
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

      {/* PnL Heatmap */}
      <Card
        title="PnL Heatmap (Weekday × Hour, UTC)"
        subtitle="Average PnL per trade in each time bucket. Blue = positive, Red = negative. Intensity = magnitude."
      >
        {sample.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-sm text-zinc-500">
            No trades for current filters.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs text-zinc-500">
                Scale uses max |avg| in visible cells:{" "}
                <span className="font-semibold text-zinc-200 tabular-nums">${fmtMoney(heat.maxAbs)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="tabular-nums">0</span>
                <div className="h-2 w-28 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="h-full w-1/2 inline-block"
                    style={{
                      background:
                        "linear-gradient(to right, rgba(43,74,111,0.15), rgba(43,74,111,0.80))",
                    }}
                  />
                  <div
                    className="h-full w-1/2 inline-block"
                    style={{
                      background:
                        "linear-gradient(to right, rgba(107,43,43,0.15), rgba(107,43,43,0.80))",
                    }}
                  />
                </div>
                <span className="tabular-nums">max</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid" style={{ gridTemplateColumns: `80px repeat(24, 1fr)` }}>
                  <div className="text-[11px] text-zinc-500 px-2 py-1">UTC</div>
                  {heat.hours.map((h) => (
                    <div
                      key={h}
                      className="text-[10px] text-zinc-500 px-1 py-1 text-center tabular-nums"
                    >
                      {String(h).padStart(2, "0")}
                    </div>
                  ))}
                </div>

                {heat.days.map((day) => (
                  <div
                    key={day}
                    className="grid items-stretch"
                    style={{ gridTemplateColumns: `80px repeat(24, 1fr)` }}
                  >
                    <div className="text-xs text-zinc-300 px-2 py-2 font-semibold">{day}</div>

                    {heat.hours.map((hour) => {
                      const key = `${day}|${hour}`;
                      const cell = heat.cellMap.get(key);
                      const avg = cell?.avg ?? 0;
                      const n = cell?.n ?? 0;

                      const bg = heatColor(avg, heat.maxAbs);
                      const title =
                        `${day} ${hourLabel(hour)} (UTC)\n` + `avg: $${fmtMoney(avg)}\n` + `n: ${n}`;

                      return (
                        <div
                          key={key}
                          title={title}
                          className="h-9 border border-zinc-800/70 rounded-md m-[2px] flex items-center justify-center"
                          style={{ backgroundColor: bg }}
                        >
                          <span className={`text-[11px] font-semibold tabular-nums ${pnlTextClass(avg)}`}>
                            {n ? fmtMoney(avg) : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-zinc-500">
              Note: bins use <span className="font-semibold text-zinc-300">created_at</span> in{" "}
              <span className="font-semibold text-zinc-300">UTC</span>. If you want CME/NYSE local session time,
              we’ll add a selectable timezone mode next.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}