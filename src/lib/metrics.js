export function computeMetrics(trades, initialBalance = 0) {
  // expects trades with { created_at, pnl }
  const sorted = [...trades].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  let balance = Number(initialBalance) || 0;
  let totalPnl = 0;
  let wins = 0;
  let losses = 0;

  const equity = [];

  for (const t of sorted) {
    const p = Number(t.pnl) || 0;
    totalPnl += p;
    balance += p;

    if (p > 0) wins += 1;
    else if (p < 0) losses += 1;

    equity.push({
      t: t.created_at,
      balance,
      pnl: p,
    });
  }

  const count = sorted.length;
  const winrate = count ? (wins / count) * 100 : 0;

  return {
    initialBalance: Number(initialBalance) || 0,
    totalTrades: count,
    totalPnl,
    wins,
    losses,
    winrate,
    endingBalance: balance,
    equity,
  };
}