import Link from "next/link";
import { ShiftCancelButton } from "@/components/admin/ShiftCancelButton";
import { formatOperationalDateTime } from "@/lib/shifts/time";
import { createClient } from "@/lib/supabase/server";

// Determina o rótulo visual do plantão sem precisar atualizar uma coluna no banco a cada hora.
function getOperationalStatus(shift: {
  starts_at: string;
  ends_at: string;
  status: string;
}): {
  label: string;
  className: string;
} {
  if (shift.status === "cancelled") {
    return { label: "Cancelado", className: "status-cancelled" };
  }

  const now = Date.now();
  const startsAt = new Date(shift.starts_at).getTime();
  const endsAt = new Date(shift.ends_at).getTime();

  if (now >= startsAt && now < endsAt) {
    return { label: "Em andamento", className: "status-in-progress" };
  }

  if (now < startsAt) {
    return { label: "Programado", className: "status-scheduled" };
  }

  return { label: "Encerrado", className: "status-finished" };
}

// Tela principal de gestão das escalas e plantões.
export default async function AdminShiftsPage() {
  const supabase = await createClient();

  // Carrega os plantões mais recentes; para o MVP limitamos a 150 linhas.
  const { data: shifts, error: shiftsError } = await supabase
    .from("shifts")
    .select("id, team_id, starts_at, ends_at, notes, status, created_at")
    .order("starts_at", { ascending: false })
    .limit(150);

  // Carrega nomes das equipes para transformar os UUIDs em informação legível.
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name")
    .order("name");

  // Carrega somente as versões ativas das escalas para contar agentes por plantão.
  const { data: assignments, error: assignmentsError } = await supabase
    .from("shift_agents")
    .select("shift_id, agent_id, starts_at, ends_at")
    .eq("status", "scheduled");

  if (shiftsError || teamsError || assignmentsError) {
    throw new Error(
      shiftsError?.message ??
        teamsError?.message ??
        assignmentsError?.message ??
        "Não foi possível carregar os plantões.",
    );
  }

  const teamNameById = new Map((teams ?? []).map((team) => [team.id, team.name]));

  // Agrupa quantidade de agentes por plantão.
  const agentCountByShift = new Map<string, number>();

  for (const assignment of assignments ?? []) {
    agentCountByShift.set(
      assignment.shift_id,
      (agentCountByShift.get(assignment.shift_id) ?? 0) + 1,
    );
  }

  const now = Date.now();
  const totalShifts = shifts?.length ?? 0;
  const inProgress =
    shifts?.filter(
      (shift) =>
        shift.status !== "cancelled" &&
        now >= new Date(shift.starts_at).getTime() &&
        now < new Date(shift.ends_at).getTime(),
    ).length ?? 0;
  const upcoming =
    shifts?.filter(
      (shift) =>
        shift.status !== "cancelled" &&
        now < new Date(shift.starts_at).getTime(),
    ).length ?? 0;
  const cancelled = shifts?.filter((shift) => shift.status === "cancelled").length ?? 0;

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="metric-label">Administração</div>
          <h1 style={{ margin: "4px 0" }}>Escalas / Plantões</h1>
          <p className="metric-label" style={{ margin: "6px 0 0" }}>
            Organize equipes de 07h a 07h e os períodos individuais de 12h ou 24h.
          </p>
        </div>

        <Link className="button" href="/admin/escalas/novo">
          + Novo plantão
        </Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="card compact-card">
          <div className="metric-label">Plantões carregados</div>
          <div className="metric-value">{totalShifts}</div>
        </div>
        <div className="card compact-card">
          <div className="metric-label">Em andamento</div>
          <div className="metric-value">{inProgress}</div>
        </div>
        <div className="card compact-card">
          <div className="metric-label">Programados</div>
          <div className="metric-value">{upcoming}</div>
        </div>
        <div className="card compact-card">
          <div className="metric-label">Cancelados</div>
          <div className="metric-value">{cancelled}</div>
        </div>
      </div>

      <div className="card">
        <div className="section-heading">
          <div>
            <h2 style={{ margin: 0 }}>Histórico de plantões</h2>
            <p className="metric-label" style={{ marginBottom: 0 }}>
              Cancelamentos não apagam o plantão nem as fiscalizações associadas.
            </p>
          </div>
        </div>

        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Equipe</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Agentes</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {(shifts ?? []).map((shift) => {
                const status = getOperationalStatus(shift);
                const agentCount = agentCountByShift.get(shift.id) ?? 0;

                return (
                  <tr key={shift.id}>
                    <td>
                      <strong>{teamNameById.get(shift.team_id) ?? "Equipe"}</strong>
                    </td>
                    <td>{formatOperationalDateTime(shift.starts_at)}</td>
                    <td>{formatOperationalDateTime(shift.ends_at)}</td>
                    <td>{agentCount}</td>
                    <td>
                      <span className={`status-badge ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link className="table-action" href={`/admin/escalas/${shift.id}`}>
                          {shift.status === "cancelled" ? "Ver" : "Editar"}
                        </Link>
                        {shift.status !== "cancelled" && (
                          <ShiftCancelButton shiftId={shift.id} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {(shifts?.length ?? 0) === 0 && (
                <tr>
                  <td className="empty-state" colSpan={6}>
                    Nenhum plantão cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
