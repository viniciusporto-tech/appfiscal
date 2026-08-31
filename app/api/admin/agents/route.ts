import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const fullName = String(body.fullName ?? "").trim();
    const registrationNumber = String(body.registrationNumber ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const phone = String(body.phone ?? "").trim();
    const workHours = Number(body.workHours) === 12 ? 12 : 24;
    const status = body.status === "inactive" ? "inactive" : "active";
    const memberships = Array.isArray(body.memberships) ? body.memberships : [];

    if (fullName.length < 3 || !registrationNumber || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return NextResponse.json({ error: "Preencha nome, matrícula, e-mail e senha de pelo menos 8 caracteres." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (authError || !authData.user) return NextResponse.json({ error: authError?.message ?? "Falha ao criar login." }, { status: 400 });

    const userId = authData.user.id;
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId, registration_number: registrationNumber, full_name: fullName, phone: phone || null,
      role: "agent", work_hours: workHours, status,
    });
    if (profileError) {
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    if (memberships.length) {
      const rows = memberships.map((item: any, index: number) => ({
        agent_id: userId,
        team_id: String(item.teamId),
        is_primary: index === 0,
        default_period: workHours === 24 ? "full" : item.period === "night" ? "night" : "day",
      }));
      const { error } = await supabase.from("agent_teams").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await supabase.from("audit_logs").insert({ user_id: admin.id, action: "agent.created", entity_type: "profiles", entity_id: userId, details: { fullName, registrationNumber } });
    return NextResponse.json({ message: "Agente cadastrado com sucesso." }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ error: message === "UNAUTHORIZED" || message === "FORBIDDEN" ? "Acesso negado." : message }, { status: 500 });
  }
}
