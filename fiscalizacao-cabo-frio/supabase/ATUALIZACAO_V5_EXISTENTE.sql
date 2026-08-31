-- =============================================================
-- APPFISCAL V5 - ATUALIZAÇÃO ÚNICA PARA BANCO EXISTENTE
-- Execute este arquivo no SQL Editor do Supabase.
-- Preparado para atualizar versões MVP e PRO.
-- =============================================================

alter table public.inspections add column if not exists status text not null default 'active';
alter table public.inspections drop constraint if exists inspections_status_check;
alter table public.inspections add constraint inspections_status_check check (status in ('active','cancelled'));

-- =============================================================
-- 006_admin_management.sql
-- Atualiza um banco antigo para os novos cadastros do painel.
-- =============================================================

alter table public.profiles add column if not exists phone text;
alter table public.teams add column if not exists description text;
alter table public.teams add column if not exists updated_at timestamptz not null default now();
alter table public.infraction_types add column if not exists description text;
alter table public.infraction_types add column if not exists legal_basis text;
alter table public.infraction_types add column if not exists severity text default 'normal';
alter table public.infraction_types add column if not exists updated_at timestamptz not null default now();
alter table public.vehicles add column if not exists brand_model text;
alter table public.vehicles add column if not exists color text;
alter table public.vehicles add column if not exists notes text;
alter table public.vehicles add column if not exists active boolean not null default true;
alter table public.vehicles add column if not exists created_at timestamptz not null default now();
alter table public.vehicles add column if not exists updated_at timestamptz not null default now();
alter table public.system_settings add column if not exists shift_cycle_days smallint not null default 4;
alter table public.system_settings add column if not exists organization_name text not null default 'Fiscalização Cabo Frio';

update public.system_settings set shift_cycle_days = 4 where id = 1 and shift_cycle_days is null;


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


-- =============================================================
-- 009_authorized_vehicles.sql
-- Ônibus e vans autorizados + tipos de serviço administráveis.
-- Pode ser executado sobre bancos das versões anteriores.
-- =============================================================

create table if not exists public.service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_authorizations (
  id uuid primary key default gen_random_uuid(),
  plate text not null references public.vehicles(plate) on update cascade on delete restrict,
  service_type_id uuid not null references public.service_types(id),
  company_name text not null,
  valid_from date not null,
  valid_until date not null,
  permitted_start_time time,
  permitted_end_time time,
  allowed_area text,
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_authorizations_period_check check (valid_until >= valid_from)
);

create index if not exists vehicle_authorizations_plate_idx
  on public.vehicle_authorizations(plate, valid_until desc);
create index if not exists vehicle_authorizations_validity_idx
  on public.vehicle_authorizations(valid_from, valid_until);
create index if not exists vehicle_authorizations_service_idx
  on public.vehicle_authorizations(service_type_id);

alter table public.service_types enable row level security;
alter table public.vehicle_authorizations enable row level security;

drop policy if exists service_types_select_authenticated on public.service_types;
create policy service_types_select_authenticated
on public.service_types for select to authenticated
using (active = true or public.is_admin());

drop policy if exists vehicle_authorizations_select_authenticated on public.vehicle_authorizations;
create policy vehicle_authorizations_select_authenticated
on public.vehicle_authorizations for select to authenticated
using (true);

-- Consulta consolidada usada pelo agente ao consultar uma placa.
create or replace function public.vehicle_authorization_lookup(p_plate text)
returns table (
  authorization_id uuid,
  plate text,
  vehicle_type text,
  brand_model text,
  color text,
  fleet_prefix text,
  company_name text,
  service_type_name text,
  valid_from date,
  valid_until date,
  permitted_start_time time,
  permitted_end_time time,
  allowed_area text,
  notes text,
  authorization_status text
)
language sql
stable
security definer
set search_path = public
as $$
  with local_now as (
    select timezone('America/Sao_Paulo', now()) as current_local
  )
  select
    a.id,
    a.plate,
    v.vehicle_type,
    v.brand_model,
    v.color,
    v.fleet_prefix,
    a.company_name,
    st.name,
    a.valid_from,
    a.valid_until,
    a.permitted_start_time,
    a.permitted_end_time,
    a.allowed_area,
    a.notes,
    case
      when not a.active then 'revoked'
      when (ln.current_local::date) < a.valid_from then 'not_started'
      when (ln.current_local::date) > a.valid_until then 'expired'
      when (ln.current_local::date) = a.valid_from
           and a.permitted_start_time is not null
           and ln.current_local::time < a.permitted_start_time then 'not_started'
      when (ln.current_local::date) = a.valid_until
           and a.permitted_end_time is not null
           and (a.permitted_start_time is null or a.permitted_start_time <= a.permitted_end_time)
           and ln.current_local::time > a.permitted_end_time then 'expired'
      when a.permitted_start_time is not null and a.permitted_end_time is not null
           and a.permitted_start_time <= a.permitted_end_time
           and not (ln.current_local::time between a.permitted_start_time and a.permitted_end_time) then 'outside_hours'
      when a.permitted_start_time is not null and a.permitted_end_time is not null
           and a.permitted_start_time > a.permitted_end_time
           and not (ln.current_local::time >= a.permitted_start_time or ln.current_local::time <= a.permitted_end_time) then 'outside_hours'
      when a.permitted_start_time is not null and a.permitted_end_time is null
           and ln.current_local::time < a.permitted_start_time then 'outside_hours'
      when a.permitted_start_time is null and a.permitted_end_time is not null
           and ln.current_local::time > a.permitted_end_time then 'outside_hours'
      else 'valid'
    end
  from public.vehicle_authorizations a
  join public.vehicles v on v.plate = a.plate
  join public.service_types st on st.id = a.service_type_id
  cross join local_now ln
  where a.plate = upper(regexp_replace(p_plate, '[^A-Za-z0-9]', '', 'g'))
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active'
    )
  order by a.valid_until desc, a.created_at desc;
$$;

grant execute on function public.vehicle_authorization_lookup(text) to authenticated;


-- =============================================================
-- ARQUIVO 006: DECRETOS EM PDF
-- Execute este arquivo depois do 005_shift_management.sql.
--
-- Objetivo:
-- - guardar apenas o nome amigável do decreto e o caminho do PDF;
-- - permitir que agentes autenticados vejam somente documentos ativos;
-- - permitir que administradores cadastrem, ativem/desativem e excluam.
-- =============================================================

-- Tabela que representa cada PDF exibido na área do agente.
create table if not exists public.decrees (
  -- Identificador técnico do documento.
  id uuid primary key default gen_random_uuid(),

  -- Nome curto mostrado para o agente, por exemplo "Decreto Trenzinho".
  name text not null,

  -- Caminho interno do arquivo dentro do bucket privado "decrees".
  storage_path text not null unique,

  -- Permite ocultar temporariamente um documento sem apagar o PDF.
  active boolean not null default true,

  -- Administrador que cadastrou o documento, quando disponível.
  created_by uuid references public.profiles(id),

  -- Datas para auditoria básica do cadastro.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ativa Row Level Security para a nova tabela.
alter table public.decrees enable row level security;

-- Remove as políticas antes de recriar para permitir executar esta migração novamente sem erro.
drop policy if exists "decrees_select_authenticated" on public.decrees;
drop policy if exists "decrees_admin_all" on public.decrees;

-- Qualquer usuário autenticado pode ler documentos ativos.
-- Administradores também conseguem enxergar os inativos no painel.
create policy "decrees_select_authenticated"
on public.decrees for select
to authenticated
using (active = true or public.is_admin());

-- Somente administradores podem criar, editar ou excluir registros.
create policy "decrees_admin_all"
on public.decrees for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Cria o bucket privado que armazenará os PDFs.
-- O ON CONFLICT permite executar novamente sem duplicar o bucket.
insert into storage.buckets (id, name, public)
values ('decrees', 'decrees', false)
on conflict (id) do update set public = false;

-- Permite que usuários autenticados gerem links temporários apenas para decretos ativos.
drop policy if exists "decrees_storage_read_authenticated" on storage.objects;
create policy "decrees_storage_read_authenticated"
on storage.objects for select
to authenticated
using (
  bucket_id = 'decrees'
  and exists (
    select 1
    from public.decrees d
    where d.storage_path = name
      and (d.active = true or public.is_admin())
  )
);


-- =============================================================
-- 010_mobile_support.sql
-- Suporte idempotente ao aplicativo nativo e à fila offline.
-- Execute uma única vez depois das migrações da versão web v4.
-- =============================================================

alter table public.inspections
  add column if not exists client_reference uuid;

create unique index if not exists inspections_client_reference_uidx
  on public.inspections(client_reference)
  where client_reference is not null;

create index if not exists inspections_agent_client_reference_idx
  on public.inspections(agent_id, client_reference)
  where client_reference is not null;

-- Nenhuma chave secreta é necessária no app. As políticas RLS atuais continuam valendo.


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


