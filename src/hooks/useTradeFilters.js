import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export function useTradeFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    return {
      from: searchParams.get("from") || "",     // YYYY-MM-DD
      to: searchParams.get("to") || "",         // YYYY-MM-DD
      symbol: searchParams.get("symbol") || "", // text
      asset: searchParams.get("asset") || "",   // futures/options/stock/...
      side: searchParams.get("side") || "",     // long/short
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