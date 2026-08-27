import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { prepareAssignments, ShiftValidationError } from "@/lib/shifts/server";
import { getShiftInterval } from "@/lib/shifts/time";
import { validateCreateShiftInput } from "@/lib/shifts/validation";

// POST /api/admin/shifts
// Cria um plantão de 24 horas e a escala inicial dos agentes.
export async function POST(request: Request) {
  try {
    // Somente administrador ativo pode criar plantões.
    const administrator = await requireAdmin();

    // Lê o JSON enviado pelo formulário.
    const body = await request.json();

    // Valida e normaliza data, equipe, observações e agentes.
    const validation = validateCreateShiftInput(body);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.message },
        { status: 400 },
      );
    }

    const shiftInput = validation.data;
    const adminSupabase = createAdminClient();

    // Confirma que a equipe existe e está ativa.
    const { data: team, error: teamError } = await adminSupabase
      .from("teams")
      .select("id, name, active")
      .eq("id", shiftInput.teamId)
      .single();

    if (teamError || !team || !team.active) {
      return NextResponse.json(
        { error: "A equipe selecionada não existe ou está inativa." },
        { status: 400 },
      );
    }

    // Calcula 07h da data escolhida até 07h do dia seguinte.
    const interval = getShiftInterval(shiftInput.serviceDate);

    // Evita criar dois plantões ativos para a mesma equipe e mesma data.
    const { data: existingShift, error: existingShiftError } = await adminSupabase
      .from("shifts")
      .select("id")
      .eq("team_id", shiftInput.teamId)
      .eq("starts_at", interval.startsAt)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existingShiftError) {
      return NextResponse.json(
        { error: existingShiftError.message },
        { status: 400 },
      );
    }

    if (existingShift) {
      return NextResponse.json(
        { error: "Já existe um plantão ativo desta equipe para a data escolhida." },
        { status: 409 },
      );
    }

    // Valida vínculo de equipe, jornada e conflito de horários antes de gravar.
    const assignments = await prepareAssignments({
      teamId: shiftInput.teamId,
      serviceDate: shiftInput.serviceDate,
      assignments: shiftInput.assignments,
    });

    // Cria primeiro o cabeçalho do plantão de 24h.
    const { data: shift, error: shiftError } = await adminSupabase
      .from("shifts")
      .insert({
        team_id: shiftInput.teamId,
        starts_at: interval.startsAt,
        ends_at: interval.endsAt,
        notes: shiftInput.notes || null,
        status: "scheduled",
        created_by: administrator.id,
      })
      .select("id")
      .single();

    if (shiftError || !shift) {
      return NextResponse.json(
        { error: shiftError?.message ?? "Não foi possível criar o plantão." },
        { status: 400 },
      );
    }

    // Insere cada período de agente apontando para o plantão recém-criado.
    if (assignments.length > 0) {
      const { error: assignmentsError } = await adminSupabase
        .from("shift_agents")
        .insert(
          assignments.map((assignment) => ({
            ...assignment,
            shift_id: shift.id,
          })),
        );

      if (assignmentsError) {
        // Como nenhuma fiscalização pode ter surgido durante esta requisição,
        // removemos o cabeçalho incompleto e informamos o erro ao administrador.
        await adminSupabase.from("shifts").delete().eq("id", shift.id);

        return NextResponse.json(
          { error: assignmentsError.message },
          { status: 400 },
        );
      }
    }

    // Registra a criação para futura auditoria administrativa.
    await adminSupabase.from("audit_logs").insert({
      user_id: administrator.id,
      action: "shift.created",
      entity_type: "shifts",
      entity_id: shift.id,
      details: {
        team_id: shiftInput.teamId,
        service_date: shiftInput.serviceDate,
        agent_count: assignments.length,
      },
    });

    return NextResponse.json(
      {
        message: "Plantão criado com sucesso.",
        shiftId: shift.id,
      },
      { status: 201 },
    );
  } catch (error) {
    // Erros de validação operacional são seguros para exibir ao usuário.
    if (error instanceof ShiftValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    console.error("Erro ao criar plantão:", error);
    return NextResponse.json(
      { error: "Erro interno ao criar o plantão." },
      { status: 500 },
    );
  }
}
