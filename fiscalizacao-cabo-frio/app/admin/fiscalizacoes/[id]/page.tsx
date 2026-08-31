import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, Car, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforcementLabel } from "@/lib/inspections/labels";
import { formatDateTime } from "@/lib/utils/format";

type Props = { params: Promise<{ id: string }> };

export default async function FiscalizacaoDetalhePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: inspection } = await supabase
    .from("inspections")
    .select(`
      *,
      profiles!inspections_agent_id_fkey(full_name,registration_number),
      teams(name),
      infraction_types(name,category,legal_basis),
      inspection_photos(id,storage_path,preserved,expires_at,deleted_at)
    `)
    .eq("id", id)
    .single();

  if (!inspection) notFound();

  const [totalResult, notifiedResult, finedResult] = await Promise.all([
    supabase.from("inspections").select("id", { count: "exact", head: true }).eq("plate", inspection.plate).eq("status", "active"),
    supabase.from("inspections").select("id", { count: "exact", head: true }).eq("plate", inspection.plate).eq("status", "active").not("infraction_type_id", "is", null),
    supabase.from("inspections").select("id", { count: "exact", head: true }).eq("plate", inspection.plate).eq("status", "active").neq("enforcement_action", "none"),
  ]);

  const availablePhotos = (inspection.inspection_photos ?? []).filter((photo: any) => !photo.deleted_at);
  const paths = availablePhotos.map((photo: any) => photo.storage_path);
  const signedByPath = new Map<string, string>();

  if (paths.length) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage.from("inspection-photos").createSignedUrls(paths, 60 * 60);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
    }
  }

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="eyebrow">Fiscalização</div>
          <h1 className="page-title">{inspection.occurrence_number}</h1>
          <p className="page-subtitle">Registro completo da ocorrência e histórico do veículo.</p>
        </div>
        <div className="topbar-actions">
          <Link className="button button-secondary" href={`/admin/veiculos/${inspection.plate}`}><Car size={18} /> Histórico da placa</Link>
          <Link className="button button-secondary" href="/admin/fiscalizacoes">Voltar</Link>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card kpi-card"><div className="metric-label">Fiscalizações desta placa</div><div className="metric-value">{totalResult.count ?? 0}</div></div>
        <div className="card kpi-card"><div className="metric-label">Notificações desta placa</div><div className="metric-value">{notifiedResult.count ?? 0}</div></div>
        <div className="card kpi-card"><div className="metric-label">Multas registradas</div><div className="metric-value">{finedResult.count ?? 0}</div></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="section-heading"><h2>Dados da ocorrência</h2></div>
          <div className="detail-grid">
            <div className="detail-item"><span>Placa</span><strong>{inspection.plate}</strong></div>
            <div className="detail-item"><span>Data/hora</span><strong>{formatDateTime(inspection.captured_at)}</strong></div>
            <div className="detail-item"><span>Equipe</span><strong>{inspection.teams?.name ?? "—"}</strong></div>
            <div className="detail-item"><span>Agente</span><strong>{inspection.profiles?.full_name ?? "—"}</strong></div>
            <div className="detail-item"><span>Veículo</span><strong>{inspection.vehicle_type}</strong></div>
            <div className="detail-item"><span>Infração</span><strong>{inspection.infraction_types?.name ?? "Somente fiscalização"}</strong></div>
            <div className="detail-item"><span>Resultado da abordagem</span><strong>{enforcementLabel(inspection.enforcement_action)}</strong></div>
            <div className="detail-item"><span>Status</span><strong>{inspection.status === "active" ? "Ativa" : "Cancelada"}</strong></div>
          </div>
          {inspection.infraction_types?.legal_basis && <div className="notice"><strong>Base legal:</strong> {inspection.infraction_types.legal_basis}</div>}
          <div className="field" style={{ marginTop: 16 }}>
            <label className="label">Observações</label>
            <div className="notice">{inspection.notes ?? "Sem observações."}</div>
          </div>
        </div>

        <div className="card">
          <div className="section-heading"><h2>Localização</h2></div>
          <div className="location-highlight">
            <MapPin size={22} />
            <div><span>Endereço da ocorrência</span><strong>{inspection.address ?? "Endereço não registrado"}</strong></div>
          </div>
          <div className="detail-grid" style={{ marginTop: 12 }}>
            <div className="detail-item"><span>Latitude</span><strong>{inspection.latitude ?? "—"}</strong></div>
            <div className="detail-item"><span>Longitude</span><strong>{inspection.longitude ?? "—"}</strong></div>
            <div className="detail-item"><span>Precisão GPS</span><strong>{inspection.gps_accuracy ? `${inspection.gps_accuracy} m` : "—"}</strong></div>
            <div className="detail-item"><span>Fotos anexadas</span><strong>{availablePhotos.length}</strong></div>
          </div>
          {inspection.latitude && inspection.longitude && (
            <a className="button button-secondary" style={{ marginTop: 16 }} target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${inspection.latitude}&mlon=${inspection.longitude}#map=18/${inspection.latitude}/${inspection.longitude}`}>
              Abrir localização no mapa
            </a>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-heading"><h2><Camera size={18} style={{ verticalAlign: "middle" }} /> Evidências fotográficas</h2></div>
        {availablePhotos.length ? (
          <div className="photo-gallery">
            {availablePhotos.map((photo: any) => {
              const url = signedByPath.get(photo.storage_path);
              return url ? (
                <a key={photo.id} href={url} target="_blank" rel="noreferrer" className="photo-card">
                  <img src={url} alt={`Evidência ${inspection.occurrence_number}`} />
                  <div className="photo-meta">{photo.preserved ? "Foto preservada" : `Retenção: ${formatDateTime(photo.expires_at)}`}</div>
                </a>
              ) : null;
            })}
          </div>
        ) : <div className="empty-state">Nenhuma foto disponível para esta ocorrência.</div>}
      </div>
    </section>
  );
}
