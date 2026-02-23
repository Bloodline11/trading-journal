import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

function fmtDT(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export default function Trades() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const load = async () => {
    setError("");
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      setError("No user session. Please log in again.");
      return;
    }

    // IMPORTANT:
    // - Use executed_at as the primary timestamp for sorting/meaning.
    // - Fall back to created_at only for legacy rows (executed_at will exist now, but old rows may still be fine).
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .order("executed_at", { ascending: false })
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setRows(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Trades</h1>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="rounded border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm hover:bg-zinc-800"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={() => navigate("/trades/new")}
            className="rounded bg-zinc-700 px-4 py-2 text-sm hover:bg-zinc-600"
          >
            Add Trade
          </button>
        </div>
      </div>

      {loading && <p className="mt-4 text-zinc-400">Loading...</p>}

      {error && (
        <p className="mt-4 rounded border border-red-900 bg-red-950 p-2 text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="mt-4 text-zinc-400">No trades yet.</p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950 text-left text-zinc-300">
              <tr>
                <th className="p-3">Executed</th>
                <th className="p-3">Symbol</th>
                <th className="p-3">Side</th>
                <th className="p-3">Entry</th>
                <th className="p-3">Exit</th>
                <th className="p-3">Size</th>
                <th className="p-3">PnL</th>
                <th className="p-3">Notes</th>
                <th className="p-3"></th>
              </tr>
            </thead>

            <tbody className="bg-zinc-900">
              {rows.map((t) => (
                <Row key={t.id} trade={t} onDeleted={load} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ trade, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");

  const del = async () => {
    setErr("");
    const ok = confirm("Delete this trade?");
    if (!ok) return;

    setDeleting(true);

    const { error } = await supabase.from("trades").delete().eq("id", trade.id);

    setDeleting(false);

    if (error) {
      setErr(error.message);
      return;
    }

    onDeleted();
  };

  const executed = trade.executed_at ?? trade.created_at;

  return (
    <tr className="border-t border-zinc-800 align-top">
      <td className="p-3 text-zinc-300">
        <div className="font-medium">{fmtDT(executed)}</div>
        <div className="mt-0.5 text-[11px] text-zinc-500">
          created: {fmtDT(trade.created_at)}
        </div>
      </td>

      <td className="p-3">{trade.symbol}</td>
      <td className="p-3">{trade.side}</td>
      <td className="p-3">{trade.entry_price ?? "-"}</td>
      <td className="p-3">{trade.exit_price ?? "-"}</td>
      <td className="p-3">{trade.size ?? "-"}</td>

      <td className="p-3 tabular-nums">
        {trade.pnl ?? "-"}
      </td>

      <td className="p-3 text-zinc-300">
        {trade.notes && trade.notes.trim().length > 0 ? trade.notes : <span className="text-zinc-600">—</span>}
      </td>

      <td className="p-3 text-right">
        <button
          type="button"
          onClick={del}
          disabled={deleting}
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs hover:bg-zinc-800 disabled:opacity-60"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>

        {err && <div className="mt-1 text-xs text-red-300">{err}</div>}
      </td>
    </tr>
  );
}