"use client";

import { createClient } from "@/lib/supabase/client";
import type { EnforcementAction } from "@/lib/inspections/labels";

export type InspectionPayload = {
  plate: string;
  vehicleType: string;
  infractionId: string | null;
  notes: string;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  address: string | null;
  enforcementAction: EnforcementAction;
  capturedAt: string;
};

// Envia uma fiscalização e localiza a equipe pelo plantão válido no momento da ocorrência.
export async function uploadInspection(
  payload: InspectionPayload,
  photo?: Blob | null,
  photoName?: string | null,
  photoType?: string | null,
) {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Sessão inválida.");

  const { data: shift, error: shiftError } = await supabase
    .from("shift_agents")
    .select("shift_id,team_id")
    .eq("agent_id", user.id)
    .eq("status", "scheduled")
    .lte("starts_at", payload.capturedAt)
    .gte("ends_at", payload.capturedAt)
    .limit(1)
    .maybeSingle();

  if (shiftError) throw shiftError;
  if (!shift) throw new Error("Nenhum plantão válido foi encontrado para o horário da fiscalização.");

  const { data: inspection, error } = await supabase
    .from("inspections")
    .insert({
      agent_id: user.id,
      team_id: shift.team_id,
      shift_id: shift.shift_id,
      plate: payload.plate,
      vehicle_type: payload.vehicleType,
      infraction_type_id: payload.infractionId,
      notes: payload.notes || null,
      latitude: payload.latitude,
      longitude: payload.longitude,
      gps_accuracy: payload.gpsAccuracy,
      address: payload.address || null,
      enforcement_action: payload.enforcementAction,
      captured_at: payload.capturedAt,
    })
    .select("id,occurrence_number")
    .single();

  if (error || !inspection) throw error ?? new Error("Falha ao registrar fiscalização.");

  if (photo) {
    const ext = (photoName?.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "");
    const path = `${inspection.id}/${crypto.randomUUID()}.${ext || "jpg"}`;
    const { error: uploadError } = await supabase.storage
      .from("inspection-photos")
      .upload(path, photo, { contentType: photoType || "image/jpeg", upsert: false });
    if (uploadError) throw uploadError;

    const { error: metaError } = await supabase.from("inspection_photos").insert({
      inspection_id: inspection.id,
      storage_path: path,
      preserved: false,
    });
    if (metaError) throw metaError;
  }

  return inspection;
}
