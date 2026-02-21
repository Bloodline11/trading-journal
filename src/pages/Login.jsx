import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md bg-zinc-900 p-6 rounded-xl border border-zinc-800"
      >
        <h1 className="text-xl font-semibold mb-4">Login</h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-3 p-2 bg-zinc-800 border border-zinc-700 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-3 p-2 bg-zinc-800 border border-zinc-700 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-red-400 mb-2">{error}</p>}

        <button className="w-full bg-zinc-700 hover:bg-zinc-600 p-2 rounded">
          Login
        </button>

        <p className="mt-3 text-sm text-zinc-400">
          No account? <Link to="/register" className="underline">Register</Link>
        </p>
      </form>
    </div>
  );
}