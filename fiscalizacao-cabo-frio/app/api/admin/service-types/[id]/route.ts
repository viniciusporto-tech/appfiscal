import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const adminUser = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const name = String(body.name ?? "").trim();

    if (!name) {
      return NextResponse.json({ error: "Informe o nome do tipo de serviço." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("service_types")
      .update({
        name,
        description: String(body.description ?? "").trim() || null,
        active: body.active !== false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await admin.from("audit_logs").insert({
      user_id: adminUser.id,
      action: "service_type.updated",
      entity_type: "service_types",
      entity_id: id,
      details: { name, active: body.active !== false },
    });

    return NextResponse.json({ message: "Tipo de serviço atualizado." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno." }, { status: 500 });
  }
}
