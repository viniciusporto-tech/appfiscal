-- =============================================================
-- ARQUIVO 005: GESTÃO DE ESCALAS E PLANTÕES
-- Execute depois dos arquivos 001 a 004.
--
-- Este arquivo também serve para quem já criou o banco usando
-- uma versão anterior do projeto: as colunas são adicionadas
-- somente quando ainda não existem.
-- =============================================================

-- Estado do plantão: "scheduled" continua válido operacionalmente;
-- "cancelled" permanece apenas para consulta histórica.
alter table public.shifts
add column if not exists status text not null default 'scheduled';

-- Momento em que o plantão foi cancelado.
alter table public.shifts
add column if not exists cancelled_at timestamptz;

-- Administrador responsável pelo cancelamento.
alter table public.shifts
add column if not exists cancelled_by uuid references public.profiles(id);

-- Restrição de valores permitidos para o status do plantão.
-- O bloco verifica se a constraint já existe para permitir reexecução segura.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shifts_status_check'
      and conrelid = 'public.shifts'::regclass
  ) then
    alter table public.shifts
    add constraint shifts_status_check
    check (status in ('scheduled', 'cancelled'));
  end if;
end;
$$;

-- Estado do vínculo do agente. Quando a escala é alterada, a versão
-- anterior vira "cancelled" em vez de ser apagada.
alter table public.shift_agents
add column if not exists status text not null default 'scheduled';

-- Data da substituição/cancelamento daquele vínculo.
alter table public.shift_agents
add column if not exists cancelled_at timestamptz;

-- Administrador que realizou a substituição/cancelamento.
alter table public.shift_agents
add column if not exists cancelled_by uuid references public.profiles(id);

-- Restringe os estados aceitos no vínculo da escala.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shift_agents_status_check'
      and conrelid = 'public.shift_agents'::regclass
  ) then
    alter table public.shift_agents
    add constraint shift_agents_status_check
    check (status in ('scheduled', 'cancelled'));
  end if;
end;
$$;

-- Evita dois plantões ativos da mesma equipe começando no mesmo horário.
-- Plantões cancelados não bloqueiam a criação de uma nova versão correta.
create unique index if not exists shifts_unique_active_team_start
on public.shifts (team_id, starts_at)
where status = 'scheduled';

-- Índices usados com frequência para localizar a escala atual do agente.
create index if not exists shift_agents_active_agent_period
on public.shift_agents (agent_id, starts_at, ends_at)
where status = 'scheduled';

create index if not exists shift_agents_shift_status
on public.shift_agents (shift_id, status);

-- Índice usado pela tela administrativa ao listar plantões por data/equipe.
create index if not exists shifts_team_start_status
on public.shifts (team_id, starts_at, status);

-- =============================================================
-- FUNÇÕES TRANSACIONAIS USADAS PELO SERVIDOR NEXT.JS
-- A service_role chama estas funções somente depois de confirmar
-- que a sessão atual pertence a um administrador ativo.
-- =============================================================

-- Substitui a composição ativa de um plantão dentro de uma única transação.
-- Se qualquer insert falhar, o PostgreSQL desfaz toda a operação automaticamente.
create or replace function public.replace_shift_assignments(
  p_shift_id uuid,
  p_notes text,
  p_assignments jsonb,
  p_changed_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  -- Bloqueia e carrega o plantão para impedir duas edições simultâneas conflitantes.
  select team_id
  into v_team_id
  from public.shifts
  where id = p_shift_id
    and status = 'scheduled'
  for update;

  if v_team_id is null then
    raise exception 'Plantão não encontrado ou cancelado.';
  end if;

  -- Atualiza apenas a observação geral; equipe/data não mudam em edição.
  update public.shifts
  set notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = p_shift_id;

  -- Preserva a versão anterior da escala como cancelada/substituída.
  update public.shift_agents
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = p_changed_by
  where shift_id = p_shift_id
    and status = 'scheduled';

  -- Insere a nova versão ativa enviada pelo servidor.
  insert into public.shift_agents (
    shift_id,
    agent_id,
    team_id,
    starts_at,
    ends_at,
    notes,
    status
  )
  select
    p_shift_id,
    (item->>'agent_id')::uuid,
    v_team_id,
    (item->>'starts_at')::timestamptz,
    (item->>'ends_at')::timestamptz,
    nullif(trim(coalesce(item->>'notes', '')), ''),
    'scheduled'
  from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) as item;
end;
$$;

-- Cancela cabeçalho e agentes do plantão dentro da mesma transação.
create or replace function public.cancel_shift(
  p_shift_id uuid,
  p_changed_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mantém o registro do plantão e marca seu estado como cancelado.
  update public.shifts
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = p_changed_by
  where id = p_shift_id
    and status = 'scheduled';

  if not found then
    raise exception 'Plantão não encontrado ou já cancelado.';
  end if;

  -- Cancela também todos os vínculos que ainda estavam operacionais.
  update public.shift_agents
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = p_changed_by
  where shift_id = p_shift_id
    and status = 'scheduled';
end;
$$;

-- Ninguém do navegador pode executar essas funções diretamente.
revoke all on function public.replace_shift_assignments(uuid, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.cancel_shift(uuid, uuid) from public, anon, authenticated;

-- Somente a credencial administrativa usada no servidor pode chamá-las.
grant execute on function public.replace_shift_assignments(uuid, text, jsonb, uuid) to service_role;
grant execute on function public.cancel_shift(uuid, uuid) to service_role;
