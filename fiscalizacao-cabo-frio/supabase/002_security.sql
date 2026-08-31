-- =============================================================
-- 002_security.sql - RLS
-- =============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.agent_teams enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_agents enable row level security;
alter table public.infraction_types enable row level security;
alter table public.vehicles enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.system_settings enable row level security;
alter table public.audit_logs enable row level security;

-- Remove políticas antigas com os mesmos nomes para permitir reexecução.
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists teams_select_authenticated on public.teams;
create policy teams_select_authenticated on public.teams for select to authenticated using (true);

drop policy if exists agent_teams_select_self_or_admin on public.agent_teams;
create policy agent_teams_select_self_or_admin on public.agent_teams for select to authenticated using (agent_id = auth.uid() or public.is_admin());

drop policy if exists shifts_select_authenticated on public.shifts;
create policy shifts_select_authenticated on public.shifts for select to authenticated using (true);

drop policy if exists shift_agents_select_self_or_admin on public.shift_agents;
create policy shift_agents_select_self_or_admin on public.shift_agents for select to authenticated using (agent_id = auth.uid() or public.is_admin());

drop policy if exists infractions_select_authenticated on public.infraction_types;
create policy infractions_select_authenticated on public.infraction_types for select to authenticated using (active = true or public.is_admin());

drop policy if exists vehicles_select_authenticated on public.vehicles;
create policy vehicles_select_authenticated on public.vehicles for select to authenticated using (true);

drop policy if exists inspections_select_self_or_admin on public.inspections;
create policy inspections_select_self_or_admin on public.inspections for select to authenticated using (agent_id = auth.uid() or public.is_admin());

drop policy if exists inspections_insert_self on public.inspections;
create policy inspections_insert_self on public.inspections for insert to authenticated with check (agent_id = auth.uid());

drop policy if exists photos_select_owner_or_admin on public.inspection_photos;
create policy photos_select_owner_or_admin on public.inspection_photos for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.inspections i where i.id = inspection_id and i.agent_id = auth.uid()
  )
);

drop policy if exists photos_insert_owner on public.inspection_photos;
create policy photos_insert_owner on public.inspection_photos for insert to authenticated with check (
  exists (select 1 from public.inspections i where i.id = inspection_id and i.agent_id = auth.uid())
);

drop policy if exists settings_admin_select on public.system_settings;
create policy settings_admin_select on public.system_settings for select to authenticated using (public.is_admin());

drop policy if exists audit_admin_select on public.audit_logs;
create policy audit_admin_select on public.audit_logs for select to authenticated using (public.is_admin());

-- Escritas administrativas comuns são feitas por rotas de servidor com chave secreta.
