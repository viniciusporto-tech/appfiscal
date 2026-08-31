import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePlate } from "@/lib/utils/format";

function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdmin();
    const body = await request.json();
    const plate = normalizePlate(String(body.plate ?? ""));
    const companyName = String(body.companyName ?? "").trim();
    const serviceTypeId = String(body.serviceTypeId ?? "").trim();
    const validFrom = String(body.validFrom ?? "").trim();
    const validUntil = String(body.validUntil ?? "").trim();

    if (plate.length < 7) return NextResponse.json({ error: "Informe uma placa válida." }, { status: 400 });
    if (!companyName) return NextResponse.json({ error: "Informe a empresa responsável." }, { status: 400 });
    if (!serviceTypeId) return NextResponse.json({ error: "Selecione o tipo de serviço." }, { status: 400 });
    if (!validFrom || !validUntil) return NextResponse.json({ error: "Informe as datas de início e término." }, { status: 400 });
    if (validUntil < validFrom) return NextResponse.json({ error: "A data final não pode ser anterior à inicial." }, { status: 400 });

    const admin = createAdminClient();

    const { error: vehicleError } = await admin.from("vehicles").upsert({
      plate,
      vehicle_type: String(body.vehicleType ?? "Van"),
      brand_model: optionalText(body.brandModel),
      color: optionalText(body.color),
      company_name: companyName,
      fleet_prefix: optionalText(body.fleetPrefix),
      notes: optionalText(body.vehicleNotes),
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "plate" });

    if (vehicleError) return NextResponse.json({ error: vehicleError.message }, { status: 400 });

    const { data, error } = await admin.from("vehicle_authorizations").insert({
      plate,
      service_type_id: serviceTypeId,
      company_name: companyName,
      valid_from: validFrom,
      valid_until: validUntil,
      permitted_start_time: optionalText(body.permittedStartTime),
      permitted_end_time: optionalText(body.permittedEndTime),
      allowed_area: optionalText(body.allowedArea),
      notes: optionalText(body.notes),
      active: body.active !== false,
      created_by: adminUser.id,
    }).select("id").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await admin.from("audit_logs").insert({
      user_id: adminUser.id,
      action: "vehicle_authorization.created",
      entity_type: "vehicle_authorizations",
      entity_id: data.id,
      details: { plate, companyName, validFrom, validUntil },
    });

    return NextResponse.json({ id: data.id, message: "Autorização cadastrada." }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno." }, { status: 500 });
  }
}
