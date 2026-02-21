import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
      <form
        onSubmit={handleRegister}
        className="w-full max-w-md bg-zinc-900 p-6 rounded-xl border border-zinc-800"
      >
        <h1 className="text-xl font-semibold mb-4">Register</h1>

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
          Register
        </button>

        <p className="mt-3 text-sm text-zinc-400">
          Already have an account?{" "}
          <Link to="/login" className="underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}