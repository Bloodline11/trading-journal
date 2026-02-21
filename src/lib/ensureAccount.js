import { supabase } from "./supabase";

export async function ensureDefaultAccount() {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData?.user;
  if (!user) return;

  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (existing && existing.length > 0) return;

  await supabase.from("accounts").insert([
    {
      user_id: user.id,
      name: "Main",
      initial_balance: 0,
    },
  ]);
}