import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const fullName = String(body.fullName ?? "").trim();
    const registrationNumber = String(body.registrationNumber ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const phone = String(body.phone ?? "").trim();
    const workHours = Number(body.workHours) === 12 ? 12 : 24;
    const status = body.status === "inactive" ? "inactive" : "active";
    const memberships = Array.isArray(body.memberships) ? body.memberships : [];

    const supabase = createAdminClient();
    const authUpdate: { email: string; password?: string } = { email };
    if (password) authUpdate.password = password;
    const { error: authError } = await supabase.auth.admin.updateUserById(id, authUpdate);
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    const { error: profileError } = await supabase.from("profiles").update({
      registration_number: registrationNumber, full_name: fullName, phone: phone || null,
      work_hours: workHours, status, updated_at: new Date().toISOString(),
    }).eq("id", id).eq("role", "agent");
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

    await supabase.from("agent_teams").delete().eq("agent_id", id);
    if (memberships.length) {
      const rows = memberships.map((item: any, index: number) => ({
        agent_id: id, team_id: String(item.teamId), is_primary: index === 0,
        default_period: workHours === 24 ? "full" : item.period === "night" ? "night" : "day",
      }));
      const { error } = await supabase.from("agent_teams").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await supabase.from("audit_logs").insert({ user_id: admin.id, action: "agent.updated", entity_type: "profiles", entity_id: id, details: { fullName, status } });
    return NextResponse.json({ message: "Agente atualizado." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno." }, { status: 500 });
  }
}
