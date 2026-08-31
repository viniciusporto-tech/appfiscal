import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorizedVehicleForm } from "@/components/admin/AuthorizedVehicleForm";
import { authorizationBadgeClass, authorizationStatus, authorizationStatusLabels } from "@/lib/authorizations/status";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

export default async function AuthorizationDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: row }, { data: serviceTypes }] = await Promise.all([
    supabase.from("vehicle_authorizations").select(`*,vehicles(vehicle_type,brand_model,color,fleet_prefix),service_types(name)`).eq("id", id).single(),
    supabase.from("service_types").select("id,name,active").order("name"),
  ]);
  if (!row) notFound();

  const status = authorizationStatus(row);
  return (
    <section className="admin-form-page">
      <div className="topbar">
        <div><div className="eyebrow">Autorização</div><h1 className="page-title">{row.plate}</h1><p className="page-subtitle">{row.company_name} • {row.service_types?.name ?? "Serviço"}</p></div>
        <div className="topbar-actions"><span className={`status-badge ${authorizationBadgeClass(status)}`}>{authorizationStatusLabels[status]}</span><Link className="button button-secondary" href="/admin/autorizacoes">Voltar</Link></div>
      </div>
      <AuthorizedVehicleForm
        serviceTypes={serviceTypes ?? []}
        initial={{
          id: row.id,
          plate: row.plate,
          vehicleType: row.vehicles?.vehicle_type ?? "Van",
          brandModel: row.vehicles?.brand_model ?? "",
          color: row.vehicles?.color ?? "",
          fleetPrefix: row.vehicles?.fleet_prefix ?? "",
          companyName: row.company_name,
          serviceTypeId: row.service_type_id,
          validFrom: row.valid_from,
          validUntil: row.valid_until,
          permittedStartTime: row.permitted_start_time?.slice(0, 5) ?? "",
          permittedEndTime: row.permitted_end_time?.slice(0, 5) ?? "",
          allowedArea: row.allowed_area ?? "",
          notes: row.notes ?? "",
          active: row.active,
        }}
      />
    </section>
  );
}
