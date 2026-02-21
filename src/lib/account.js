import { supabase } from "./supabase";

export async function getAccount() {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error) throw error;

  return data;
}

export async function updateInitialBalance(newBalance) {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData?.user;
  if (!user) return;

  const { error } = await supabase
    .from("accounts")
    .update({ initial_balance: Number(newBalance) })
    .eq("user_id", user.id);

  if (error) throw error;
}