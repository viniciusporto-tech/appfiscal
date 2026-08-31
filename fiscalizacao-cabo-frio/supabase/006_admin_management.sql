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
