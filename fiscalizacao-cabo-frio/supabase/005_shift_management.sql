-- =============================================================
-- 005_shift_management.sql
-- Compatibilidade para bancos criados em versões anteriores.
-- =============================================================

alter table public.agent_teams add column if not exists default_period text not null default 'day';
alter table public.shifts add column if not exists status text not null default 'scheduled';
alter table public.shifts add column if not exists generation_batch_id uuid;
alter table public.shifts add column if not exists cancelled_at timestamptz;
alter table public.shifts add column if not exists cancelled_by uuid references public.profiles(id);
alter table public.shift_agents add column if not exists status text not null default 'scheduled';
alter table public.shift_agents add column if not exists created_at timestamptz not null default now();
alter table public.shift_agents add column if not exists cancelled_at timestamptz;
alter table public.shift_agents add column if not exists cancelled_by uuid references public.profiles(id);

create index if not exists shift_agents_active_agent_period on public.shift_agents (agent_id, starts_at, ends_at) where status = 'scheduled';
create index if not exists shift_agents_shift_status on public.shift_agents (shift_id, status);
