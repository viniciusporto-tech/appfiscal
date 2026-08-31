import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };
const VALID_VEHICLE_TYPES = new Set(["Carro", "Ônibus", "Van", "Táxi", "Moto", "Micro-ônibus", "Outro"]);

function vehicleTypes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(String).filter((item) => VALID_VEHICLE_TYPES.has(item))));
}

export async function PATCH(request: Request, context: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("infraction_types")
      .update({
        code: String(body.code ?? "").trim().toUpperCase() || null,
        name: String(body.name ?? "").trim(),
        category: String(body.category ?? "Geral").trim(),
        description: String(body.description ?? "").trim() || null,
        legal_basis: String(body.legalBasis ?? "").trim() || null,
        severity: String(body.severity ?? "normal"),
        active: body.active !== false,
        allowed_vehicle_types: vehicleTypes(body.allowedVehicleTypes),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabase.from("audit_logs").insert({
      user_id: admin.id,
      action: "infraction.updated",
      entity_type: "infraction_types",
      entity_id: id,
      details: { name: body.name, allowed_vehicle_types: vehicleTypes(body.allowedVehicleTypes) },
    });
    return NextResponse.json({ message: "Infração atualizada." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno." }, { status: 500 });
  }
}
