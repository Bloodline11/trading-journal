import { useEffect, useState } from "react";
import { getAccount, updateInitialBalance } from "../lib/account";

export default function Settings() {
  const [initialBalance, setInitialBalanceState] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadAccount() {
      try {
        const account = await getAccount();
        if (account) {
          setInitialBalanceState(account.initial_balance ?? 0);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadAccount();
  }, []);

  const handleSave = async () => {
    setError("");
    setSuccess("");

    const value = Number(initialBalance);
    if (!Number.isFinite(value)) {
      setError("Initial balance must be a valid number.");
      return;
    }

    try {
      setSaving(true);
      await updateInitialBalance(value);
      setSuccess("Initial balance updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
        <div>
          <label className="text-sm text-zinc-300">
            Initial Account Balance
          </label>
          <input
            type="text"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 p-2"
            value={initialBalance}
            onChange={(e) => setInitialBalanceState(e.target.value)}
            placeholder="e.g. 5000"
          />
        </div>

        {error && (
          <div className="rounded border border-red-900 bg-red-950 p-2 text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded border border-green-900 bg-green-950 p-2 text-green-300">
            {success}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-zinc-700 px-4 py-2 hover:bg-zinc-600 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}