-- =============================================================
-- SISTEMA DE FISCALIZAÇÃO - CABO FRIO
-- 001_schema.sql
-- Estrutura principal do banco de dados.
-- =============================================================

create extension if not exists pgcrypto;

-- Cria os tipos somente se ainda não existirem.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('agent', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_status') then
    create type public.user_status as enum ('active', 'inactive');
  end if;
end;
$$;

create sequence if not exists public.inspection_number_seq start 1;

-- Perfis internos. O login em si fica em auth.users.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  registration_number text unique,
  full_name text not null,
  role public.user_role not null default 'agent',
  work_hours smallint check (work_hours in (12, 24)),
  status public.user_status not null default 'active',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Equipes operacionais.
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.teams (code, name)
values
  ('A', 'Equipe A'),
  ('BRAVO', 'Equipe Bravo'),
  ('CORUJA', 'Equipe Coruja'),
  ('DELTA', 'Equipe Delta')
on conflict (code) do nothing;

-- Vínculo agente/equipe. O período padrão permite gerar a escala automaticamente.
create table if not exists public.agent_teams (
  agent_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  is_primary boolean not null default false,
  default_period text not null default 'day' check (default_period in ('day', 'night', 'full')),
  created_at timestamptz not null default now(),
  primary key (agent_id, team_id)
);

-- Plantão operacional da equipe, sempre com início/fim explícitos.
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  generation_batch_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  constraint shifts_valid_period check (ends_at > starts_at)
);

-- Versões dos agentes escalados em cada plantão.
create table if not exists public.shift_agents (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  agent_id uuid not null references public.profiles(id),
  team_id uuid not null references public.teams(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  constraint shift_agents_valid_period check (ends_at > starts_at)
);

-- Tipos de infração/notificação totalmente administráveis pelo painel.
create table if not exists public.infraction_types (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  category text not null default 'Geral',
  description text,
  legal_basis text,
  severity text default 'normal' check (severity in ('leve', 'media', 'grave', 'gravissima', 'normal')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cadastro de veículos. Pode ser alimentado manualmente ou criado pela primeira fiscalização.
create table if not exists public.vehicles (
  plate text primary key,
  vehicle_type text,
  brand_model text,
  color text,
  company_name text,
  fleet_prefix text,
  route_name text,
  notes text,
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Registro central de fiscalização.
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  occurrence_number text unique,
  agent_id uuid not null references public.profiles(id),
  team_id uuid not null references public.teams(id),
  shift_id uuid not null references public.shifts(id),
  plate text not null references public.vehicles(plate),
  vehicle_type text not null,
  infraction_type_id uuid references public.infraction_types(id),
  notes text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  gps_accuracy numeric(10, 2),
  address text,
  enforcement_action text not null default 'none' check (enforcement_action in ('none', 'municipal_guard', 'transport_inspector')),
  captured_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- Metadados das fotos salvas em bucket privado.
create table if not exists public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  storage_path text not null unique,
  expires_at timestamptz,
  preserved boolean not null default false,
  preservation_reason text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Configurações administrativas globais.
create table if not exists public.system_settings (
  id smallint primary key default 1 check (id = 1),
  photo_retention_days smallint check (photo_retention_days is null or photo_retention_days between 1 and 3650),
  shift_cycle_days smallint not null default 4 check (shift_cycle_days between 1 and 30),
  organization_name text not null default 'Fiscalização Cabo Frio',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.system_settings (id, photo_retention_days, shift_cycle_days)
values (1, 60, 4)
on conflict (id) do nothing;

-- Histórico de ações administrativas e operacionais importantes.
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- Gera CF-AAAA-000001 automaticamente.
create or replace function public.set_occurrence_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.occurrence_number is null then
    new.occurrence_number := 'CF-' || extract(year from new.captured_at)::int || '-' || lpad(nextval('public.inspection_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_occurrence_number on public.inspections;
create trigger trg_set_occurrence_number
before insert on public.inspections
for each row execute function public.set_occurrence_number();

-- Cria/atualiza o veículo automaticamente antes da fiscalização.
create or replace function public.upsert_vehicle_before_inspection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.plate := upper(regexp_replace(new.plate, '[^A-Za-z0-9]', '', 'g'));
  insert into public.vehicles (plate, vehicle_type, first_seen_at, last_seen_at)
  values (new.plate, new.vehicle_type, new.captured_at, new.captured_at)
  on conflict (plate) do update
  set vehicle_type = excluded.vehicle_type,
      last_seen_at = excluded.last_seen_at,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_upsert_vehicle_before_inspection on public.inspections;
create trigger trg_upsert_vehicle_before_inspection
before insert on public.inspections
for each row execute function public.upsert_vehicle_before_inspection();

-- Calcula a expiração da foto segundo a configuração do painel.
create or replace function public.set_photo_expiration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  retention_days smallint;
begin
  select photo_retention_days into retention_days from public.system_settings where id = 1;
  if new.preserved or retention_days is null then
    new.expires_at := null;
  else
    new.expires_at := coalesce(new.created_at, now()) + make_interval(days => retention_days);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_photo_expiration on public.inspection_photos;
create trigger trg_set_photo_expiration
before insert on public.inspection_photos
for each row execute function public.set_photo_expiration();

-- Índices mais usados.
create index if not exists inspections_plate_captured_idx on public.inspections (plate, captured_at desc);
create index if not exists inspections_team_captured_idx on public.inspections (team_id, captured_at desc);
create index if not exists inspections_agent_captured_idx on public.inspections (agent_id, captured_at desc);
create index if not exists shift_agents_agent_period_idx on public.shift_agents (agent_id, starts_at, ends_at);
create index if not exists shifts_team_start_idx on public.shifts (team_id, starts_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create unique index if not exists shifts_unique_active_team_start on public.shifts (team_id, starts_at) where status = 'scheduled';
