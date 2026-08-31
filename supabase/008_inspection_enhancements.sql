-- =============================================================
-- 008_inspection_enhancements.sql
-- Endereço legível + resultado da abordagem (multa/autuação).
-- Seguro para executar em bancos criados pelas versões anteriores.
-- =============================================================

alter table public.inspections
  add column if not exists enforcement_action text not null default 'none';

alter table public.inspections
  drop constraint if exists inspections_enforcement_action_check;

alter table public.inspections
  add constraint inspections_enforcement_action_check
  check (enforcement_action in ('none', 'municipal_guard', 'transport_inspector'));

create index if not exists idx_inspections_enforcement_action
  on public.inspections(enforcement_action);

create index if not exists idx_inspections_address
  on public.inspections(address);

-- Atualiza a consulta de histórico de placa usada pelo agente.
drop function if exists public.vehicle_history_lookup(text);

create function public.vehicle_history_lookup(p_plate text)
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

grant execute on function public.vehicle_history_lookup(text) to authenticated;
