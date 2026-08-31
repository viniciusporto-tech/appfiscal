import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePlate } from "@/lib/utils/format";

type Context = { params: Promise<{ id: string }> };

function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const adminUser = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const plate = normalizePlate(String(body.plate ?? ""));
    const companyName = String(body.companyName ?? "").trim();
    const serviceTypeId = String(body.serviceTypeId ?? "").trim();
    const validFrom = String(body.validFrom ?? "").trim();
    const validUntil = String(body.validUntil ?? "").trim();

    if (plate.length < 7 || !companyName || !serviceTypeId || !validFrom || !validUntil) {
      return NextResponse.json({ error: "Preencha placa, empresa, tipo de serviço e período." }, { status: 400 });
    }
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

    const { error } = await admin.from("vehicle_authorizations").update({
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
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await admin.from("audit_logs").insert({
      user_id: adminUser.id,
      action: "vehicle_authorization.updated",
      entity_type: "vehicle_authorizations",
      entity_id: id,
      details: { plate, active: body.active !== false, validFrom, validUntil },
    });

    return NextResponse.json({ message: "Autorização atualizada." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno." }, { status: 500 });
  }
}
