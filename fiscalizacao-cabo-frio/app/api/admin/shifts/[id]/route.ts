import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { prepareAssignments, ShiftValidationError } from "@/lib/shifts/server";
import { OPERATION_TIME_ZONE } from "@/lib/shifts/time";
import { validateUpdateShiftInput } from "@/lib/shifts/validation";

// Contexto da rota dinâmica /api/admin/shifts/:id.
type RouteContext = {
  params: Promise<{ id: string }>;
};

// Converte o início armazenado no banco novamente para YYYY-MM-DD no fuso operacional.
function getServiceDate(startsAt: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPERATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(startsAt));

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

// PATCH /api/admin/shifts/:id
// Substitui a escala ativa do plantão sem apagar versões anteriores.
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const administrator = await requireAdmin();
    const { id: shiftId } = await context.params;
    const body = await request.json();
    const validation = validateUpdateShiftInput(body);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.message },
        { status: 400 },
      );
    }

    const adminSupabase = createAdminClient();

    // Carrega a identidade operacional do plantão.
    const { data: shift, error: shiftError } = await adminSupabase
      .from("shifts")
      .select("id, team_id, starts_at, status")
      .eq("id", shiftId)
      .single();

    if (shiftError || !shift) {
      return NextResponse.json(
        { error: "Plantão não encontrado." },
        { status: 404 },
      );
    }

    // Plantão cancelado fica somente para consulta histórica.
    if (shift.status === "cancelled") {
      return NextResponse.json(
        { error: "Um plantão cancelado não pode ser alterado." },
        { status: 400 },
      );
    }

    // Recupera a data local original do plantão.
    const serviceDate = getServiceDate(shift.starts_at);

    // Valida a nova composição ignorando os vínculos atuais deste mesmo plantão.
    const assignments = await prepareAssignments({
      teamId: shift.team_id,
      serviceDate,
      assignments: validation.data.assignments,
      ignoreShiftId: shiftId,
    });

    // Substitui observação e composição dentro de uma única transação no PostgreSQL.
    // Se qualquer linha falhar, nenhuma parte da escala é alterada.
    const { error: replaceError } = await adminSupabase.rpc(
      "replace_shift_assignments",
      {
        p_shift_id: shiftId,
        p_notes: validation.data.notes || null,
        p_assignments: assignments.map((assignment) => ({
          agent_id: assignment.agent_id,
          starts_at: assignment.starts_at,
          ends_at: assignment.ends_at,
          notes: assignment.notes,
        })),
        p_changed_by: administrator.id,
      },
    );

    if (replaceError) {
      return NextResponse.json({ error: replaceError.message }, { status: 400 });
    }

    // Auditoria da troca de composição da equipe.
    await adminSupabase.from("audit_logs").insert({
      user_id: administrator.id,
      action: "shift.updated",
      entity_type: "shifts",
      entity_id: shiftId,
      details: {
        agent_count: assignments.length,
        service_date: serviceDate,
      },
    });

    return NextResponse.json({ message: "Escala atualizada com sucesso." });
  } catch (error) {
    if (error instanceof ShiftValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    console.error("Erro ao atualizar plantão:", error);
    return NextResponse.json(
      { error: "Erro interno ao atualizar o plantão." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/shifts/:id
// Não apaga fisicamente o plantão: apenas cancela e preserva todo o histórico.
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const administrator = await requireAdmin();
    const { id: shiftId } = await context.params;
    const adminSupabase = createAdminClient();

    // Confirma que o plantão existe antes da alteração.
    const { data: shift, error: shiftError } = await adminSupabase
      .from("shifts")
      .select("id, status")
      .eq("id", shiftId)
      .single();

    if (shiftError || !shift) {
      return NextResponse.json(
        { error: "Plantão não encontrado." },
        { status: 404 },
      );
    }

    if (shift.status === "cancelled") {
      return NextResponse.json({ message: "O plantão já está cancelado." });
    }

    // Cancela o plantão e os vínculos dos agentes dentro de uma única transação.
    const { error: cancelError } = await adminSupabase.rpc("cancel_shift", {
      p_shift_id: shiftId,
      p_changed_by: administrator.id,
    });

    if (cancelError) {
      return NextResponse.json({ error: cancelError.message }, { status: 400 });
    }

    // Guarda quem realizou o cancelamento.
    await adminSupabase.from("audit_logs").insert({
      user_id: administrator.id,
      action: "shift.cancelled",
      entity_type: "shifts",
      entity_id: shiftId,
      details: {},
    });

    return NextResponse.json({ message: "Plantão cancelado com sucesso." });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    console.error("Erro ao cancelar plantão:", error);
    return NextResponse.json(
      { error: "Erro interno ao cancelar o plantão." },
      { status: 500 },
    );
  }
}
