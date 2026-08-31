-- =============================================================
-- 007_agent_queries.sql
-- Consultas controladas para a área do agente.
-- Evitam liberar acesso amplo às tabelas completas.
-- =============================================================

-- Histórico resumido de uma placa para consulta de reincidência.
create or replace function public.vehicle_history_lookup(p_plate text)
returns table (
  occurrence_number text,
  captured_at timestamptz,
  infraction_name text,
  team_name text,
  enforcement_action text,
  address text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.occurrence_number,
    i.captured_at,
    it.name as infraction_name,
    t.name as team_name,
    i.enforcement_action,
    i.address
  from public.inspections i
  left join public.infraction_types it on it.id = i.infraction_type_id
  join public.teams t on t.id = i.team_id
  where i.plate = upper(regexp_replace(p_plate, '[^A-Za-z0-9]', '', 'g'))
    and i.status = 'active'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active'
    )
  order by i.captured_at desc
  limit 100;
$$;

-- Agentes que compõem o mesmo plantão do usuário atual.
create or replace function public.current_shift_members()
returns table (
  agent_id uuid,
  full_name text,
  registration_number text,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with my_shift as (
    select sa.shift_id
    from public.shift_agents sa
    where sa.agent_id = auth.uid()
      and sa.status = 'scheduled'
      and now() between sa.starts_at and sa.ends_at
    limit 1
  )
  select
    sa.agent_id,
    p.full_name,
    p.registration_number,
    sa.starts_at,
    sa.ends_at
  from public.shift_agents sa
  join my_shift ms on ms.shift_id = sa.shift_id
  join public.profiles p on p.id = sa.agent_id
  where sa.status = 'scheduled'
  order by sa.starts_at, p.full_name;
$$;

grant execute on function public.vehicle_history_lookup(text) to authenticated;
grant execute on function public.current_shift_members() to authenticated;
