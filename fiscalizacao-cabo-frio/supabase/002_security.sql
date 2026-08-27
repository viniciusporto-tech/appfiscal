-- =============================================================
-- ARQUIVO 002: SEGURANÇA / ROW LEVEL SECURITY (RLS)
-- Execute após o arquivo 001_schema.sql.
-- =============================================================

-- Função auxiliar que informa se o usuário atual é administrador.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

-- Ativa RLS em todas as tabelas expostas ao cliente.
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.system_settings enable row level security;
alter table public.agent_teams enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_agents enable row level security;
alter table public.infraction_types enable row level security;
alter table public.vehicles enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.audit_logs enable row level security;

-- Usuário pode ler o próprio perfil; administrador pode ler todos.
create policy "profiles_select_self_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

-- Apenas administrador pode alterar perfis internos.
create policy "profiles_admin_all"
on public.profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Apenas administradores podem consultar a configuração global completa.
create policy "system_settings_admin_select"
on public.system_settings for select
to authenticated
using (public.is_admin());

-- Apenas administradores podem alterar retenção e demais configurações globais.
create policy "system_settings_admin_update"
on public.system_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Usuários autenticados podem consultar equipes ativas.
create policy "teams_select_authenticated"
on public.teams for select
to authenticated
using (true);

-- Administração controla cadastro de equipes.
create policy "teams_admin_write"
on public.teams for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Agente pode consultar seus vínculos; administrador vê todos.
create policy "agent_teams_select_self_or_admin"
on public.agent_teams for select
to authenticated
using (agent_id = auth.uid() or public.is_admin());

-- Apenas administração altera vínculos de equipe.
create policy "agent_teams_admin_write"
on public.agent_teams for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Agentes podem consultar plantões porque precisam identificar a escala ativa.
create policy "shifts_select_authenticated"
on public.shifts for select
to authenticated
using (true);

-- Apenas administradores criam ou alteram plantões.
create policy "shifts_admin_write"
on public.shifts for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Agente vê somente sua escala; administrador enxerga todas.
create policy "shift_agents_select_self_or_admin"
on public.shift_agents for select
to authenticated
using (agent_id = auth.uid() or public.is_admin());

-- Administração controla a escala.
create policy "shift_agents_admin_write"
on public.shift_agents for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Todos os usuários autenticados podem ler a lista de infrações.
create policy "infraction_types_select_authenticated"
on public.infraction_types for select
to authenticated
using (true);

-- Apenas administrador edita tipos de infração.
create policy "infraction_types_admin_write"
on public.infraction_types for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Agentes podem consultar veículos para verificar histórico/reincidência.
create policy "vehicles_select_authenticated"
on public.vehicles for select
to authenticated
using (true);

-- Inserção/atualização de veículos é feita pelo trigger da fiscalização; admin também pode gerenciar.
create policy "vehicles_admin_write"
on public.vehicles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Agente pode consultar suas próprias fiscalizações; administrador consulta todas.
create policy "inspections_select_self_or_admin"
on public.inspections for select
to authenticated
using (agent_id = auth.uid() or public.is_admin());

-- Agente só pode inserir uma fiscalização em nome dele mesmo.
create policy "inspections_insert_self"
on public.inspections for insert
to authenticated
with check (agent_id = auth.uid());

-- Alteração e exclusão de fiscalização ficam restritas ao administrador.
create policy "inspections_admin_update"
on public.inspections for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Metadados das fotos seguem a visibilidade da fiscalização correspondente.
create policy "photos_select_owner_or_admin"
on public.inspection_photos for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.inspections i
    where i.id = inspection_id and i.agent_id = auth.uid()
  )
);

-- Agente pode cadastrar foto somente em fiscalização própria.
create policy "photos_insert_owner"
on public.inspection_photos for insert
to authenticated
with check (
  exists (
    select 1 from public.inspections i
    where i.id = inspection_id and i.agent_id = auth.uid()
  )
);

-- Preservação/exclusão lógica de fotos fica com a administração.
create policy "photos_admin_update"
on public.inspection_photos for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Logs são visíveis apenas para administradores.
create policy "audit_logs_admin_select"
on public.audit_logs for select
to authenticated
using (public.is_admin());
