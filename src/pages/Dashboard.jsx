// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getAccount } from "../lib/account";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function fmtMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Time priority rule:
 * 1) executed_at
 * 2) created_at
 */
function getTradeTime(t) {
  return t?.executed_at || t?.created_at;
}

/**
 * Convert ISO timestamp -> UTC day key "YYYY-MM-DD"
 * We use UTC to prevent timezone shifting bugs.
 */
function utcDayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Invalid";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Dashboard DAILY equity curve (performance from 0)
 * - 1 point per UTC day
 * - Explicit 0 starting anchor
 * - Cumulative from zero (PnL performance)
 */
function computeDailyEquity(trades) {
  const sorted = [...(trades || [])].sort((a, b) => {
    const ta = new Date(getTradeTime(a));
    const tb = new Date(getTradeTime(b));
    return ta - tb;
  });

  const dailyPnlMap = new Map();

  for (const t of sorted) {
    const ts = getTradeTime(t);
    if (!ts) continue;

    const key = utcDayKey(ts);
    const pnl = Number(t.pnl) || 0;

    dailyPnlMap.set(key, (dailyPnlMap.get(key) || 0) + pnl);
  }

  const dayKeys = Array.from(dailyPnlMap.keys()).sort();

  let balance = 0;
  const result = [];

  // Explicit zero anchor
  result.push({
    i: 0,
    day: "Start",
    pnl: 0,
    balance: 0,
  });

  dayKeys.forEach((dayKey, idx) => {
    const pnl = Number((dailyPnlMap.get(dayKey) || 0).toFixed(2));
    balance = Number((balance + pnl).toFixed(2));

    result.push({
      i: idx + 1,
      day: dayKey,
      pnl,
      balance,
    });
  });

  return result;
}

/**
 * Per-trade stats engine (for the stat cards)
 *
 * IMPORTANT:
 * - Performance curve starts at 0 (cumulative pnl) for "equity" series if needed.
 * - BUT drawdown is calculated on ACCOUNT EQUITY:
 *   accountEquity = initialBalance + cumulativePnl
 *
 * Max Drawdown % definition (professional):
 *   ddPct = (peakAccountEquity - currentAccountEquity) / peakAccountEquity * 100
 */
function computeEquityAndStats(trades, initialBalance) {
  const sorted = [...(trades || [])].sort((a, b) => {
    const ta = new Date(getTradeTime(a));
    const tb = new Date(getTradeTime(b));
    return ta - tb;
  });

  const initBal = Number(initialBalance) || 0;

  // Performance curve (starts at 0)
  let perf = 0;

  // Account equity curve (starts at initial balance)
  let accountEquity = initBal;
  let peakAccountEquity = initBal;

  let totalPnl = 0;
  let wins = 0;
  let losses = 0;

  let sumWins = 0;
  let sumLossAbs = 0;

  let maxDd = 0; // dollars
  let maxDdPct = 0; // percent of PEAK ACCOUNT EQUITY

  const equity = [];

  for (const t of sorted) {
    const pnl = Number(t.pnl) || 0;
    totalPnl += pnl;

    // performance from 0
    perf += pnl;

    // account equity for drawdown
    accountEquity = initBal + perf;

    if (pnl > 0) {
      wins += 1;
      sumWins += pnl;
    } else if (pnl < 0) {
      losses += 1;
      sumLossAbs += Math.abs(pnl);
    }

    // update peak account equity
    if (accountEquity > peakAccountEquity) peakAccountEquity = accountEquity;

    // drawdown in dollars from peak
    const dd = peakAccountEquity - accountEquity;
    if (dd > maxDd) maxDd = dd;

    // drawdown % relative to peak account equity
    const ddPct = peakAccountEquity > 0 ? (dd / peakAccountEquity) * 100 : 0;
    if (ddPct > maxDdPct) maxDdPct = ddPct;

    // keep series as performance curve (0-based) for consistency
    equity.push({
      i: equity.length + 1,
      balance: Number(perf.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
    });
  }

  const totalTrades = sorted.length;
  const winrate = totalTrades ? (wins / totalTrades) * 100 : 0;

  const endingBalance = initBal + totalPnl;

  const avgWin = wins ? sumWins / wins : 0;
  const avgLoss = losses ? -(sumLossAbs / losses) : 0; // negative number for display
  const profitFactor =
    sumLossAbs > 0 ? sumWins / sumLossAbs : wins > 0 ? Infinity : 0;

  return {
    equity,
    initialBalance: initBal,
    endingBalance,
    totalPnl,
    totalTrades,
    wins,
    losses,
    winrate,
    maxDd,
    maxDdPct,
    avgWin,
    avgLoss,
    profitFactor,
  };
}

function DailyTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;

  const p = payload[0]?.payload;

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 shadow">
      <div className="text-zinc-400">Day: {p.day}</div>
      <div className="mt-1">
        <span className="text-zinc-400">Balance:</span>{" "}
        <span className="font-semibold tabular-nums">${fmtMoney(p.balance)}</span>
      </div>
      <div className="mt-1">
        <span className="text-zinc-400">PnL:</span>{" "}
        <span className="font-semibold tabular-nums">${fmtMoney(p.pnl)}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const acc = await getAccount();
      setAccount(acc);

      const { data } = await supabase
        .from("trades")
        .select("*")
        .order("executed_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

      setTrades(data || []);
      setLoading(false);
    }

    loadData();
  }, []);

  const stats = useMemo(() => {
    const initial = account?.initial_balance ?? 0;
    return computeEquityAndStats(trades, initial);
  }, [trades, account]);

  const dailyEquity = useMemo(() => {
    return computeDailyEquity(trades);
  }, [trades]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Initial Balance" value={`$${fmtMoney(stats.initialBalance)}`} />
        <Card title="Total PnL" value={`$${fmtMoney(stats.totalPnl)}`} />
        <Card title="Ending Balance" value={`$${fmtMoney(stats.endingBalance)}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Total Trades" value={stats.totalTrades.toLocaleString()} />
        <Card title="Winrate" value={`${stats.winrate.toFixed(2)}%`} />
        <Card
          title="Max Drawdown"
          value={`$${fmtMoney(stats.maxDd)} (${stats.maxDdPct.toFixed(2)}%)`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Avg Win" value={`$${fmtMoney(stats.avgWin)}`} />
        <Card title="Avg Loss" value={`$${fmtMoney(stats.avgLoss)}`} />
        <Card
          title="Profit Factor"
          value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-zinc-300 font-semibold">Equity Curve</div>
            <div className="text-xs text-zinc-500">
              Performance aggregated per day (UTC). Starts at zero.
            </div>
          </div>
          <div className="text-xs text-zinc-400">
            Points: <span className="text-zinc-200">{dailyEquity.length}</span>
          </div>
        </div>

        <div className="mt-4 h-[280px]">
          {dailyEquity.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">
              No trades yet — add trades to see equity curve.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dailyEquity}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `$${Math.round(v).toLocaleString()}`}
                  width={70}
                />
                <Tooltip content={<DailyTooltip />} />
                <Line type="monotone" dataKey="balance" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="text-sm text-zinc-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}