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
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function computeEquityAndStats(trades, initialBalance) {
  const sorted = [...(trades || [])].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  let balance = 0;           // start performance curve at 0
let peak = 0;

  let totalPnl = 0;
  let wins = 0;
  let losses = 0;

  let sumWins = 0;
  let sumLossAbs = 0;

  let maxDd = 0; // dollars (positive number)
  let maxDdPct = 0;

  const equity = [];

  for (const t of sorted) {
    const pnl = Number(t.pnl) || 0;
    totalPnl += pnl;

    balance += pnl;

    if (pnl > 0) {
      wins += 1;
      sumWins += pnl;
    } else if (pnl < 0) {
      losses += 1;
      sumLossAbs += Math.abs(pnl);
    }

    if (balance > peak) peak = balance;

    const dd = peak - balance; // positive if below peak
    if (dd > maxDd) maxDd = dd;

    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    if (ddPct > maxDdPct) maxDdPct = ddPct;

    equity.push({
  i: equity.length + 1,
  balance: Number(balance.toFixed(2)),
  pnl: Number(pnl.toFixed(2)),
  created_at: t.created_at,
});
  }

  const totalTrades = sorted.length;
  const winrate = totalTrades ? (wins / totalTrades) * 100 : 0;
  const endingBalance = (Number(initialBalance) || 0) + totalPnl;

  const avgWin = wins ? sumWins / wins : 0;
  const avgLoss = losses ? -(sumLossAbs / losses) : 0; // negative number for display
  const profitFactor = sumLossAbs > 0 ? sumWins / sumLossAbs : wins > 0 ? Infinity : 0;

  return {
    equity,
    initialBalance: Number(initialBalance) || 0,
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

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const p = payload[0]?.payload;
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 shadow">
      <div className="text-zinc-400">Trade #{label}</div>
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

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* Primary account cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Initial Balance" value={`$${fmtMoney(stats.initialBalance)}`} />
        <Card title="Total PnL" value={`$${fmtMoney(stats.totalPnl)}`} />
        <Card title="Ending Balance" value={`$${fmtMoney(stats.endingBalance)}`} />
      </div>

      {/* Win/loss + drawdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Total Trades" value={stats.totalTrades.toLocaleString()} />
        <Card title="Winrate" value={`${stats.winrate.toFixed(2)}%`} />
        <Card title="Max Drawdown" value={`$${fmtMoney(stats.maxDd)} (${stats.maxDdPct.toFixed(2)}%)`} />
      </div>

      {/* Advanced basics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Avg Win" value={`$${fmtMoney(stats.avgWin)}`} />
        <Card title="Avg Loss" value={`$${fmtMoney(stats.avgLoss)}`} />
        <Card
          title="Profit Factor"
          value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
        />
      </div>

      {/* Equity curve */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-zinc-300 font-semibold">Equity Curve</div>
            <div className="text-xs text-zinc-500">
              Balance after each trade (includes initial balance).
            </div>
          </div>
          <div className="text-xs text-zinc-400">
            Points: <span className="text-zinc-200">{stats.equity.length}</span>
          </div>
        </div>

        <div className="mt-4 h-[280px]">
          {stats.equity.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">
              No trades yet — add trades to see equity curve.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.equity} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="i" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `$${Math.round(v).toLocaleString()}`}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="balance"
                  strokeWidth={2}
                  dot={false}
                />
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