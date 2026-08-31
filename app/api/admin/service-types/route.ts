import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdmin();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim() || null;

    if (!name) {
      return NextResponse.json({ error: "Informe o nome do tipo de serviço." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("service_types")
      .insert({ name, description, active: body.active !== false })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await admin.from("audit_logs").insert({
      user_id: adminUser.id,
      action: "service_type.created",
      entity_type: "service_types",
      entity_id: data.id,
      details: { name },
    });

    return NextResponse.json({ message: "Tipo de serviço cadastrado." }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno." }, { status: 500 });
  }
}
