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
