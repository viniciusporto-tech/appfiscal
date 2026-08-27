import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { validateAgentInput } from "@/lib/agents/validation";
import { createAdminClient } from "@/lib/supabase/admin";

// Formato do parâmetro dinâmico usado pelo Next.js nesta rota.
type RouteContext = {
  params: Promise<{ id: string }>;
};

// PATCH /api/admin/agents/:id
// Atualiza dados funcionais, e-mail, senha opcional, status e equipes do agente.
export async function PATCH(request: Request, context: RouteContext) {
  try {
    // Confirma a identidade do administrador antes de usar a service_role.
    const administrator = await requireAdmin();

    // Obtém o UUID do agente presente na URL.
    const { id: agentId } = await context.params;

    // Lê os novos valores enviados pelo formulário.
    const body = await request.json();

    // Na edição a senha é opcional: vazia significa manter a senha atual.
    const validation = validateAgentInput(body, { passwordRequired: false });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.message },
        { status: 400 },
      );
    }

    // Dados validados que serão usados nas próximas operações.
    const agent = validation.data;

    // Cliente administrativo usado apenas no servidor.
    const adminSupabase = createAdminClient();

    // Confirma que o alvo existe e que esta tela está alterando um agente, não outro administrador.
    const { data: existingProfile, error: profileLookupError } =
      await adminSupabase
        .from("profiles")
        .select("id, role, full_name")
        .eq("id", agentId)
        .single();

    if (profileLookupError || !existingProfile) {
      return NextResponse.json(
        { error: "Agente não encontrado." },
        { status: 404 },
      );
    }

    if (existingProfile.role !== "agent") {
      return NextResponse.json(
        { error: "Esta tela só pode editar usuários do tipo agente." },
        { status: 400 },
      );
    }

    // Valida os vínculos antes de apagar as equipes antigas.
    if (agent.teamIds.length > 0) {
      const { data: validTeams, error: teamsError } = await adminSupabase
        .from("teams")
        .select("id")
        .in("id", agent.teamIds);

      if (teamsError || (validTeams?.length ?? 0) !== agent.teamIds.length) {
        return NextResponse.json(
          { error: "Uma das equipes selecionadas não existe." },
          { status: 400 },
        );
      }
    }

    // Monta somente os campos de autenticação que realmente precisam ser alterados.
    const authUpdates: { email: string; password?: string } = {
      email: agent.email,
    };

    // Senha vazia não altera a senha atual.
    if (agent.password) {
      authUpdates.password = agent.password;
    }

    // Atualiza e-mail e, quando preenchida, a nova senha no Supabase Auth.
    const { error: authUpdateError } =
      await adminSupabase.auth.admin.updateUserById(agentId, authUpdates);

    if (authUpdateError) {
      return NextResponse.json(
        { error: authUpdateError.message },
        { status: 400 },
      );
    }

    // Atualiza os dados funcionais do agente.
    const { error: profileUpdateError } = await adminSupabase
      .from("profiles")
      .update({
        registration_number: agent.registrationNumber,
        full_name: agent.fullName,
        work_hours: agent.workHours,
        status: agent.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId);

    if (profileUpdateError) {
      return NextResponse.json(
        { error: profileUpdateError.message },
        { status: 400 },
      );
    }

    // Remove os vínculos administrativos antigos para substituir pela seleção atual.
    const { error: removeTeamsError } = await adminSupabase
      .from("agent_teams")
      .delete()
      .eq("agent_id", agentId);

    if (removeTeamsError) {
      return NextResponse.json(
        { error: removeTeamsError.message },
        { status: 400 },
      );
    }

    // Recria os vínculos atuais de equipe.
    if (agent.teamIds.length > 0) {
      const { error: insertTeamsError } = await adminSupabase
        .from("agent_teams")
        .insert(
          agent.teamIds.map((teamId, index) => ({
            agent_id: agentId,
            team_id: teamId,
            is_primary: index === 0,
          })),
        );

      if (insertTeamsError) {
        return NextResponse.json(
          { error: insertTeamsError.message },
          { status: 400 },
        );
      }
    }

    // Registra a alteração para futura tela de auditoria.
    await adminSupabase.from("audit_logs").insert({
      user_id: administrator.id,
      action: "agent.updated",
      entity_type: "profiles",
      entity_id: agentId,
      details: {
        full_name: agent.fullName,
        registration_number: agent.registrationNumber,
        status: agent.status,
        team_ids: agent.teamIds,
        password_changed: Boolean(agent.password),
      },
    });

    // Confirma o resultado ao navegador.
    return NextResponse.json({ message: "Agente atualizado com sucesso." });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    console.error("Erro ao atualizar agente:", error);
    return NextResponse.json(
      { error: "Erro interno ao atualizar o agente." },
      { status: 500 },
    );
  }
}
