import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { reverseGeocode } from "@/lib/geo/reverseGeocode";
import { createAdminClient } from "@/lib/supabase/admin";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST() {
  try {
    const adminUser = await requireAdmin();
    const admin = createAdminClient();
    const { data: rows, error } = await admin
      .from("inspections")
      .select("id,latitude,longitude")
      .is("address", null)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("captured_at", { ascending: false })
      .limit(5);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!rows?.length) return NextResponse.json({ updated: 0, remaining: false, message: "Não há ocorrências pendentes de endereço." });

    let updated = 0;
    for (const row of rows) {
      try {
        const geocoded = await reverseGeocode(Number(row.latitude), Number(row.longitude));
        if (geocoded.address) {
          await admin.from("inspections").update({ address: geocoded.address, updated_at: new Date().toISOString(), updated_by: adminUser.id }).eq("id", row.id);
          updated++;
        }
      } catch (error) {
        console.error(`Falha ao preencher endereço da fiscalização ${row.id}:`, error);
      }
      await wait(1100);
    }

    const { count } = await admin.from("inspections").select("id", { count: "exact", head: true }).is("address", null).not("latitude", "is", null).not("longitude", "is", null);
    await admin.from("audit_logs").insert({ user_id: adminUser.id, action: "inspection.address_backfill", entity_type: "inspections", details: { updated } });

    return NextResponse.json({ updated, remaining: (count ?? 0) > 0, remainingCount: count ?? 0, message: `${updated} endereço(s) preenchido(s).` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao preencher endereços." }, { status: 500 });
  }
}
