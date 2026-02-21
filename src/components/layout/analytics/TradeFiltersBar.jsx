import React from "react";

export default function TradeFiltersBar({ filters, setFilter, resetFilters }) {
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