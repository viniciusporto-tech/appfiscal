import "server-only";
import { createClient } from "@/lib/supabase/server";

// Garante que a operação foi solicitada por um administrador ativo.
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("UNAUTHORIZED");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || profile.status !== "active") {
    throw new Error("FORBIDDEN");
  }

  return { id: user.id, email: user.email ?? null };
}
