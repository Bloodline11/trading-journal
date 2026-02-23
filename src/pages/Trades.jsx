import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

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
} = await supabase.auth.getUser();

const { data, error } = await supabase
  .from("trades")
  .select("*")
  .eq("user_id", user.id)
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
                <th className="p-3">Date</th>
                <th className="p-3">Symbol</th>
                <th className="p-3">Side</th>
                <th className="p-3">Entry</th>
                <th className="p-3">Exit</th>
                <th className="p-3">Size</th>
                <th className="p-3">PnL</th>
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

    const { error } = await supabase
      .from("trades")
      .delete()
      .eq("id", trade.id);

    setDeleting(false);

    if (error) {
      setErr(error.message);
      return;
    }

    onDeleted();
  };

  return (
    <tr className="border-t border-zinc-800 align-top">
      <td className="p-3 text-zinc-400">
        {new Date(trade.created_at).toLocaleString()}
      </td>
      <td className="p-3">{trade.symbol}</td>
      <td className="p-3">{trade.side}</td>
      <td className="p-3">{trade.entry_price ?? "-"}</td>
      <td className="p-3">{trade.exit_price ?? "-"}</td>
      <td className="p-3">{trade.size ?? "-"}</td>
      <td className="p-3">{trade.pnl ?? "-"}</td>
      <td className="p-3 text-right">
        <button
          type="button"
          onClick={del}
          disabled={deleting}
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs hover:bg-zinc-800 disabled:opacity-60"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>

        {err && (
          <div className="mt-1 text-xs text-red-300">
            {err}
          </div>
        )}
      </td>
    </tr>
  );
}