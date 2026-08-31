-- =============================================================
-- 012_v5_reports_infractions_carro.sql
-- AppFiscal v5: infrações por tipo de veículo + padronização "Carro".
-- IDPOTENTE: pode ser executado novamente sem duplicar estruturas.
-- Execute este arquivo no SQL Editor do Supabase após as migrações anteriores.
-- =============================================================

-- Lista vazia significa: infração disponível para TODOS os tipos de veículo.
alter table public.infraction_types
  add column if not exists allowed_vehicle_types text[] not null default '{}'::text[];

comment on column public.infraction_types.allowed_vehicle_types is
  'Tipos de veículo permitidos. Array vazio = todos os tipos.';

create index if not exists infraction_types_allowed_vehicle_types_gin_idx
  on public.infraction_types using gin (allowed_vehicle_types);

-- Padroniza dados antigos: "Carro" passa a se chamar "Carro".
update public.vehicles
set vehicle_type = 'Carro', updated_at = now()
where lower(coalesce(vehicle_type, '')) in ('automóvel', 'automovel');

update public.inspections
set vehicle_type = 'Carro', updated_at = now()
where lower(coalesce(vehicle_type, '')) in ('automóvel', 'automovel');

-- Índices úteis para filtros e relatórios configuráveis.
create index if not exists inspections_infraction_captured_idx
  on public.inspections (infraction_type_id, captured_at desc);

create index if not exists inspections_vehicle_type_captured_idx
  on public.inspections (vehicle_type, captured_at desc);

create index if not exists vehicles_vehicle_type_idx
  on public.vehicles (vehicle_type);

create index if not exists vehicles_company_name_idx
  on public.vehicles (company_name);

-- Impede no banco combinações inválidas entre tipo do veículo e infração.
create or replace function public.validate_inspection_infraction_vehicle_type()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allowed_types text[];
  is_active boolean;
begin
  if new.infraction_type_id is null then
    return new;
  end if;

  select allowed_vehicle_types, active
    into allowed_types, is_active
  from public.infraction_types
  where id = new.infraction_type_id;

  if allowed_types is null then
    raise exception 'Tipo de infração não encontrado.';
  end if;

  if tg_op = 'INSERT' and not is_active then
    raise exception 'Esta infração está inativa.';
  end if;

  if cardinality(allowed_types) > 0 and not (new.vehicle_type = any(allowed_types)) then
    raise exception 'Esta infração não é permitida para o tipo de veículo informado (%).', new.vehicle_type;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_inspection_infraction_vehicle_type on public.inspections;
create trigger trg_validate_inspection_infraction_vehicle_type
before insert or update of infraction_type_id, vehicle_type
on public.inspections
for each row
execute function public.validate_inspection_infraction_vehicle_type();

-- Fortalece a inserção: o agente só registra dentro do próprio plantão/equipe e horário válido.
drop policy if exists "inspections_insert_self" on public.inspections;
create policy "inspections_insert_self"
on public.inspections for insert
to authenticated
with check (
  agent_id = auth.uid()
  and exists (
    select 1
    from public.shift_agents sa
    where sa.agent_id = auth.uid()
      and sa.shift_id = inspections.shift_id
      and sa.team_id = inspections.team_id
      and sa.status = 'scheduled'
      and inspections.captured_at between sa.starts_at and sa.ends_at
  )
);
