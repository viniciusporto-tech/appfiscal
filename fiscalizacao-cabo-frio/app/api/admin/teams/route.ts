import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(); const body = await request.json();
    const code = String(body.code ?? "").trim().toUpperCase(); const name = String(body.name ?? "").trim(); const description = String(body.description ?? "").trim();
    if (!code || !name) return NextResponse.json({ error: "Informe código e nome." }, { status: 400 });
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("teams").insert({ code, name, description: description || null, active: body.active !== false }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabase.from("audit_logs").insert({ user_id: admin.id, action: "team.created", entity_type: "teams", entity_id: data.id, details: { code, name } });
    return NextResponse.json({ message: "Equipe criada." }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno." }, { status: 500 }); }
}
