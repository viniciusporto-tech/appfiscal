import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_VEHICLE_TYPES = new Set(["Carro", "Ônibus", "Van", "Táxi", "Moto", "Micro-ônibus", "Outro"]);

function vehicleTypes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(String).filter((item) => VALID_VEHICLE_TYPES.has(item))));
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const category = String(body.category ?? "Geral").trim();
    if (!name) return NextResponse.json({ error: "Informe o nome da infração." }, { status: 400 });

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("infraction_types")
      .insert({
        code: String(body.code ?? "").trim().toUpperCase() || null,
        name,
        category,
        description: String(body.description ?? "").trim() || null,
        legal_basis: String(body.legalBasis ?? "").trim() || null,
        severity: String(body.severity ?? "normal"),
        active: body.active !== false,
        allowed_vehicle_types: vehicleTypes(body.allowedVehicleTypes),
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabase.from("audit_logs").insert({
      user_id: admin.id,
      action: "infraction.created",
      entity_type: "infraction_types",
      entity_id: data.id,
      details: { name, category, allowed_vehicle_types: vehicleTypes(body.allowedVehicleTypes) },
    });
    return NextResponse.json({ message: "Infração criada." }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno." }, { status: 500 });
  }
}
