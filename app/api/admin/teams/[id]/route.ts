import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    const admin = await requireAdmin(); const { id } = await context.params; const body = await request.json();
    const code = String(body.code ?? "").trim().toUpperCase(); const name = String(body.name ?? "").trim(); const description = String(body.description ?? "").trim();
    const supabase = createAdminClient();
    const { error } = await supabase.from("teams").update({ code, name, description: description || null, active: body.active !== false, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabase.from("audit_logs").insert({ user_id: admin.id, action: "team.updated", entity_type: "teams", entity_id: id, details: { code, name } });
    return NextResponse.json({ message: "Equipe atualizada." });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno." }, { status: 500 }); }
}
