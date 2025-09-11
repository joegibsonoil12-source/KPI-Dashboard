// src/lib/getUserRole.js
import { supabase } from "./supabaseClient";

export async function getUserRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null, full_name: "" };

  const { data, error } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (error) {
    console.warn("getUserRole error:", error);
    return { user, role: null, full_name: "" };
  }

  return { user, role: data?.role ?? null, full_name: data?.full_name ?? "" };
}
