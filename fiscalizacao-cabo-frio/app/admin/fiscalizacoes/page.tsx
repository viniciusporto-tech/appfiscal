import Link from "next/link";
import { Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforcementLabel } from "@/lib/inspections/labels";
import { formatDateTime } from "@/lib/utils/format";
import { safeSearchTerm } from "@/lib/utils/query";
import { AddressBackfillButton } from "@/components/admin/AddressBackfillButton";

type Props = {
  searchParams: Promise<{
    q?: string;
    team?: string;
    infraction?: string;
    enforcement?: string;
    from?: string;
    to?: string;
  }>;
};

type PhotoRow = { storage_path: string; deleted_at: string | null };

export default async function FiscalizacoesPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = safeSearchTerm(params.q ?? "");
  const supabase = await createClient();

  const [{ data: teams }, { data: infractions }] = await Promise.all([
    supabase.from("teams").select("id,name").eq("active", true).order("name"),
    supabase.from("infraction_types").select("id,name,category").order("category").order("name"),
  ]);

  let query = supabase
    .from("inspections")
    .select(`
      id,
      occurrence_number,
      plate,
      captured_at,
      team_id,
      status,
      address,
      enforcement_action,
      profiles!inspections_agent_id_fkey(full_name),
      infraction_types(id,name),
      inspection_photos(storage_path,deleted_at)
    `)
    .order("captured_at", { ascending: false })
    .limit(500);

  if (q) {
    query = query.or(`plate.ilike.%${q}%,occurrence_number.ilike.%${q}%,address.ilike.%${q}%,notes.ilike.%${q}%`);
  }
  if (params.team) query = query.eq("team_id", params.team);
  if (params.infraction) query = query.eq("infraction_type_id", params.infraction);
  if (params.enforcement) query = query.eq("enforcement_action", params.enforcement);
  if (params.from) query = query.gte("captured_at", `${params.from}T00:00:00-03:00`);
  if (params.to) query = query.lte("captured_at", `${params.to}T23:59:59-03:00`);

  const { data, error } = await query;
  const rows = data ?? [];
  const teamMap = new Map((teams ?? []).map((team) => [team.id, team.name]));

  // O bucket é privado. Geramos links temporários apenas para as miniaturas exibidas ao administrador.
  const firstPhotoPathByInspection = new Map<string, string>();
  for (const item of rows as any[]) {
    const firstPhoto = ((item.inspection_photos ?? []) as PhotoRow[]).find((photo) => !photo.deleted_at);
    if (firstPhoto) firstPhotoPathByInspection.set(item.id, firstPhoto.storage_path);
  }

  const signedUrlByPath = new Map<string, string>();
  const photoPaths = Array.from(new Set(firstPhotoPathByInspection.values()));
  if (photoPaths.length) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage.from("inspection-photos").createSignedUrls(photoPaths, 60 * 60);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) signedUrlByPath.set(item.path, item.signedUrl);
    }
  }

  const hasFilters = Boolean(q || params.team || params.infraction || params.enforcement || params.from || params.to);

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="eyebrow">Operação</div>
          <h1 className="page-title">Fiscalizações</h1>
          <p className="page-subtitle">Pesquise por ocorrência, placa, endereço, observação, equipe, infração, período ou resultado da abordagem.</p>
        </div>
        <AddressBackfillButton />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <form method="GET" action="/admin/fiscalizacoes" className="grid grid-3">
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Busca</label>
            <input className="input" name="q" defaultValue={params.q ?? ""} placeholder="Placa, CF-2026..., rua ou observação" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Equipe</label>
            <select className="select" name="team" defaultValue={params.team ?? ""}>
              <option value="">Todas as equipes</option>
              {(teams ?? []).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Infração</label>
            <select className="select" name="infraction" defaultValue={params.infraction ?? ""}>
              <option value="">Todas as infrações</option>
              {(infractions ?? []).map((item) => <option key={item.id} value={item.id}>{item.category} — {item.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Resultado</label>
            <select className="select" name="enforcement" defaultValue={params.enforcement ?? ""}>
              <option value="">Todos</option>
              <option value="none">Não foi multado</option>
              <option value="municipal_guard">Multado pela Guarda</option>
              <option value="transport_inspector">Multado pelo Fiscal</option>
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label">De</label>
            <input className="input" type="date" name="from" defaultValue={params.from ?? ""} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Até</label>
            <input className="input" type="date" name="to" defaultValue={params.to ?? ""} />
          </div>
          <div className="topbar-actions" style={{ gridColumn: "1 / -1" }}>
            <button className="button"><Search size={18} /> Pesquisar ocorrências</button>
            {hasFilters && <Link className="button button-secondary" href="/admin/fiscalizacoes"><X size={18} /> Limpar filtros</Link>}
          </div>
        </form>
      </div>

      {error && <div className="notice notice-error">Falha ao consultar fiscalizações: {error.message}</div>}

      <div className="card">
        <div className="section-heading">
          <h2>Ocorrências encontradas</h2>
          <span className="status-badge status-scheduled">{rows.length} registro(s)</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Foto</th><th>Ocorrência</th><th>Data</th><th>Placa</th><th>Infração</th><th>Resultado</th><th>Endereço</th><th>Equipe</th><th>Agente</th>
              </tr>
            </thead>
            <tbody>
              {(rows as any[]).map((item) => {
                const path = firstPhotoPathByInspection.get(item.id);
                const photoUrl = path ? signedUrlByPath.get(path) : undefined;
                return (
                  <tr key={item.id}>
                    <td>{photoUrl ? <img className="inspection-thumb" src={photoUrl} alt={`Foto da ocorrência ${item.occurrence_number}`} /> : <span className="field-help">Sem foto</span>}</td>
                    <td><Link className="table-action" href={`/admin/fiscalizacoes/${item.id}`}>{item.occurrence_number}</Link></td>
                    <td>{formatDateTime(item.captured_at)}</td>
                    <td><strong><Link href={`/admin/veiculos/${item.plate}`}>{item.plate}</Link></strong></td>
                    <td>{item.infraction_types?.name ?? "Somente fiscalização"}</td>
                    <td><span className={`status-badge ${item.enforcement_action === "none" ? "status-finished" : "status-inactive"}`}>{enforcementLabel(item.enforcement_action)}</span></td>
                    <td className="address-cell">{item.address ?? "Endereço não registrado"}</td>
                    <td>{teamMap.get(item.team_id) ?? "—"}</td>
                    <td>{item.profiles?.full_name ?? "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={9} className="empty-state">Nenhuma fiscalização encontrada com esses filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
