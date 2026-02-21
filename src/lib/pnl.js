export function calcPnl({
  side,
  entryPrice,
  exitPrice,
  size,
  multiplier = 1,
}) {
  const e = Number(entryPrice);
  const x = Number(exitPrice);
  const s = Number(size);
  const m = Number(multiplier);

  if (!side || !Number.isFinite(e) || !Number.isFinite(x) || !Number.isFinite(s) || !Number.isFinite(m)) {
    return 0;
  }

  // Long: (exit - entry) * size * multiplier
  // Short: (entry - exit) * size * multiplier
  const raw = side === "LONG" ? (x - e) : (e - x);
  const pnl = raw * s * m;

  // Keep numeric (Supabase numeric is fine). Round for display elsewhere if needed.
  return pnl;
}