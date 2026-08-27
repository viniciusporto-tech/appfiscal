-- =============================================================
-- SISTEMA DE FISCALIZAÇÃO - CABO FRIO
-- ARQUIVO 001: ESTRUTURA PRINCIPAL DO BANCO DE DADOS
-- Execute este arquivo no SQL Editor do Supabase.
-- =============================================================

-- Ativa a extensão pgcrypto para criação de UUIDs seguros.
create extension if not exists pgcrypto;

-- Cria um tipo controlado para os perfis de acesso do sistema.
create type public.user_role as enum ('agent', 'admin');

-- Cria um tipo controlado para o estado operacional do usuário.
create type public.user_status as enum ('active', 'inactive');

-- Cria a sequência numérica usada nos números de ocorrência.
create sequence if not exists public.inspection_number_seq start 1;

-- Tabela de perfis internos ligada aos usuários do Supabase Auth.
create table public.profiles (
  -- O ID é o mesmo UUID existente em auth.users.
  id uuid primary key references auth.users(id) on delete cascade,
  -- Matrícula funcional usada para identificação interna.
  registration_number text unique,
  -- Nome completo do servidor/agente.
  full_name text not null,
  -- Perfil define se o usuário é agente ou administrador.
  role public.user_role not null default 'agent',
  -- Jornada padrão em horas; normalmente 12 ou 24.
  work_hours smallint check (work_hours in (12, 24)),
  -- Permite desativar acesso sem apagar o histórico do servidor.
  status public.user_status not null default 'active',
  -- Data de criação do cadastro interno.
  created_at timestamptz not null default now(),
  -- Data da última alteração.
  updated_at timestamptz not null default now()
);

-- Tabela das equipes operacionais.
create table public.teams (
  -- Identificador técnico da equipe.
  id uuid primary key default gen_random_uuid(),
  -- Código curto usado em filtros e relatórios.
  code text not null unique,
  -- Nome mostrado no sistema.
  name text not null unique,
  -- Equipes antigas podem ser desativadas sem perder histórico.
  active boolean not null default true,
  -- Data de criação.
  created_at timestamptz not null default now()
);

-- Insere as quatro equipes atuais.
insert into public.teams (code, name)
values
  ('A', 'Equipe A'),
  ('BRAVO', 'Equipe Bravo'),
  ('CORUJA', 'Equipe Coruja'),
  ('DELTA', 'Equipe Delta')
on conflict (code) do nothing;

-- Configurações globais controladas pela administração.
create table public.system_settings (
  -- Mantemos apenas uma linha de configuração global, identificada pelo número 1.
  id smallint primary key default 1 check (id = 1),
  -- Quantidade de dias que uma foto permanece armazenada; NULL significa sem exclusão automática.
  photo_retention_days smallint check (photo_retention_days is null or photo_retention_days between 1 and 3650),
  -- Usuário que realizou a última alteração administrativa.
  updated_by uuid references public.profiles(id),
  -- Momento da última alteração.
  updated_at timestamptz not null default now()
);

-- Cria a configuração inicial com retenção de 60 dias.
insert into public.system_settings (id, photo_retention_days)
values (1, 60)
on conflict (id) do nothing;

-- Relação opcional que informa em quais equipes um agente costuma atuar.
create table public.agent_teams (
  -- Identificador do agente.
  agent_id uuid not null references public.profiles(id) on delete cascade,
  -- Identificador da equipe.
  team_id uuid not null references public.teams(id) on delete cascade,
  -- Marca uma equipe como principal apenas para referência administrativa.
  is_primary boolean not null default false,
  -- Evita repetir a mesma relação agente/equipe.
  primary key (agent_id, team_id)
);

-- Tabela dos plantões de 24 horas das equipes.
create table public.shifts (
  -- Identificador único do plantão.
  id uuid primary key default gen_random_uuid(),
  -- Equipe responsável pelo plantão.
  team_id uuid not null references public.teams(id),
  -- Início do plantão; no cenário atual normalmente às 07:00.
  starts_at timestamptz not null,
  -- Fim do plantão; normalmente 24 horas depois, às 07:00.
  ends_at timestamptz not null,
  -- Observação administrativa opcional.
  notes text,
  -- Estado do plantão. Cancelado permanece no histórico e deixa de valer operacionalmente.
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  -- Usuário que criou o plantão.
  created_by uuid references public.profiles(id),
  -- Data de criação do registro.
  created_at timestamptz not null default now(),
  -- Momento em que o plantão foi cancelado, quando aplicável.
  cancelled_at timestamptz,
  -- Administrador que cancelou o plantão.
  cancelled_by uuid references public.profiles(id),
  -- Impede plantões com término anterior ao início.
  constraint shifts_valid_period check (ends_at > starts_at)
);

-- Tabela que define exatamente em qual equipe e horário cada agente trabalhou.
create table public.shift_agents (
  -- Identificador técnico do vínculo de escala.
  id uuid primary key default gen_random_uuid(),
  -- Plantão de 24 horas ao qual o período pertence.
  shift_id uuid not null references public.shifts(id) on delete cascade,
  -- Agente escalado.
  agent_id uuid not null references public.profiles(id),
  -- Equipe gravada também aqui para consulta rápida e histórico explícito.
  team_id uuid not null references public.teams(id),
  -- Horário real de entrada do agente (pode ser 07h ou 19h, por exemplo).
  starts_at timestamptz not null,
  -- Horário real de saída do agente (12h ou 24h depois, conforme escala).
  ends_at timestamptz not null,
  -- Observação para troca, cobertura ou situação excepcional.
  notes text,
  -- Estado desta versão da escala. Versões substituídas ficam canceladas no histórico.
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  -- Momento em que este vínculo foi substituído/cancelado.
  cancelled_at timestamptz,
  -- Administrador responsável pela alteração.
  cancelled_by uuid references public.profiles(id),
  -- Evita período inválido.
  constraint shift_agents_valid_period check (ends_at > starts_at)
);

-- Tipos de infração/notificação cadastrados pela administração.
create table public.infraction_types (
  -- Identificador da infração.
  id uuid primary key default gen_random_uuid(),
  -- Nome apresentado no formulário do agente.
  name text not null,
  -- Categoria ajuda a separar transporte, estacionamento, táxi/van etc.
  category text not null,
  -- Código interno opcional da infração.
  code text,
  -- Permite retirar uma opção da lista sem apagar registros antigos.
  active boolean not null default true,
  -- Data de criação.
  created_at timestamptz not null default now()
);

-- Cadastro consolidado de veículos observados pelo sistema.
create table public.vehicles (
  -- Placa normalizada vira a chave principal para facilitar busca por reincidência.
  plate text primary key,
  -- Tipo mais recente informado para o veículo.
  vehicle_type text,
  -- Empresa é útil para ônibus, vans ou outros transportes vinculados a operador.
  company_name text,
  -- Prefixo operacional do veículo, quando existir.
  fleet_prefix text,
  -- Linha de transporte, quando existir.
  route_name text,
  -- Data em que a placa apareceu pela primeira vez.
  first_seen_at timestamptz not null default now(),
  -- Data da ocorrência mais recente.
  last_seen_at timestamptz not null default now()
);

-- Tabela central das fiscalizações realizadas em campo.
create table public.inspections (
  -- Identificador técnico da fiscalização.
  id uuid primary key default gen_random_uuid(),
  -- Número amigável mostrado para usuários e relatórios.
  occurrence_number text unique,
  -- Agente que fez o registro.
  agent_id uuid not null references public.profiles(id),
  -- Equipe em que o agente estava no momento da fiscalização.
  team_id uuid not null references public.teams(id),
  -- Plantão relacionado à ocorrência.
  shift_id uuid not null references public.shifts(id),
  -- Placa do veículo; referência ao histórico consolidado.
  plate text not null references public.vehicles(plate),
  -- Tipo de veículo informado naquela ocorrência.
  vehicle_type text not null,
  -- Tipo de infração escolhido.
  infraction_type_id uuid references public.infraction_types(id),
  -- Texto livre para detalhes da fiscalização.
  notes text,
  -- Latitude capturada pelo navegador.
  latitude numeric(10, 7),
  -- Longitude capturada pelo navegador.
  longitude numeric(10, 7),
  -- Precisão estimada do GPS em metros.
  gps_accuracy numeric(10, 2),
  -- Endereço aproximado poderá ser preenchido posteriormente por geocodificação reversa.
  address text,
  -- Momento informado pelo aparelho em que a fiscalização ocorreu.
  captured_at timestamptz not null,
  -- Momento em que o servidor recebeu o registro.
  created_at timestamptz not null default now(),
  -- Usuário responsável pela última alteração administrativa.
  updated_by uuid references public.profiles(id),
  -- Momento da última alteração.
  updated_at timestamptz not null default now()
);

-- Tabela com metadados das fotos armazenadas no Supabase Storage.
create table public.inspection_photos (
  -- Identificador técnico da foto.
  id uuid primary key default gen_random_uuid(),
  -- Fiscalização à qual a imagem pertence.
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  -- Caminho real do arquivo dentro do bucket privado.
  storage_path text not null unique,
  -- Data em que a foto poderá ser removida automaticamente.
  expires_at timestamptz,
  -- Quando verdadeiro, impede exclusão automática da evidência.
  preserved boolean not null default false,
  -- Motivo pelo qual a imagem foi preservada.
  preservation_reason text,
  -- Data de criação do registro.
  created_at timestamptz not null default now(),
  -- Data em que o arquivo foi efetivamente removido do Storage.
  deleted_at timestamptz
);

-- Função que define a data de expiração da foto no servidor.
create or replace function public.set_photo_expiration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Variável local que receberá o prazo configurado pelo administrador.
  retention_days smallint;
begin
  -- Busca a configuração global atual.
  select photo_retention_days
    into retention_days
  from public.system_settings
  where id = 1;

  -- Fotos marcadas como preservadas nunca recebem expiração automática.
  if new.preserved then
    new.expires_at := null;
    return new;
  end if;

  -- NULL na configuração significa que nenhuma foto será apagada automaticamente.
  if retention_days is null then
    new.expires_at := null;
  else
    -- Calcula a expiração a partir do momento em que o registro da foto é criado.
    new.expires_at := coalesce(new.created_at, now()) + make_interval(days => retention_days);
  end if;

  return new;
end;
$$;

-- Executa a regra acima antes de cada nova foto ser cadastrada.
create trigger trg_set_photo_expiration
before insert on public.inspection_photos
for each row
execute function public.set_photo_expiration();

-- Histórico de ações relevantes para auditoria.
create table public.audit_logs (
  -- Identificador técnico do log.
  id bigint generated always as identity primary key,
  -- Usuário que realizou a ação.
  user_id uuid references public.profiles(id),
  -- Nome da ação realizada.
  action text not null,
  -- Nome da entidade afetada, por exemplo inspections ou profiles.
  entity_type text not null,
  -- ID da entidade em formato texto para aceitar UUID ou outros tipos.
  entity_id text,
  -- Informações adicionais estruturadas em JSON.
  details jsonb,
  -- Data/hora registrada pelo servidor.
  created_at timestamptz not null default now()
);

-- Função que cria o número da ocorrência antes da inserção.
create or replace function public.set_occurrence_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Formato final: CF-2026-000001.
  new.occurrence_number := 'CF-' || extract(year from new.captured_at)::int || '-' || lpad(nextval('public.inspection_number_seq')::text, 6, '0');
  return new;
end;
$$;

-- Gatilho que executa a função acima para cada nova fiscalização.
create trigger trg_set_occurrence_number
before insert on public.inspections
for each row
when (new.occurrence_number is null)
execute function public.set_occurrence_number();

-- Função que cria/atualiza automaticamente o cadastro consolidado do veículo.
create or replace function public.upsert_vehicle_before_inspection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Normaliza a placa para maiúsculas.
  new.plate := upper(regexp_replace(new.plate, '[^A-Za-z0-9]', '', 'g'));

  -- Cria o veículo se ainda não existir ou atualiza sua última aparição.
  insert into public.vehicles (plate, vehicle_type, first_seen_at, last_seen_at)
  values (new.plate, new.vehicle_type, new.captured_at, new.captured_at)
  on conflict (plate) do update
    set vehicle_type = excluded.vehicle_type,
        last_seen_at = excluded.last_seen_at;

  return new;
end;
$$;

-- O trigger roda antes da inserção para garantir que a FK da placa já exista.
create trigger trg_upsert_vehicle_before_inspection
before insert on public.inspections
for each row
execute function public.upsert_vehicle_before_inspection();

-- Índice para busca rápida de fiscalizações por placa e data.
create index inspections_plate_captured_idx on public.inspections (plate, captured_at desc);

-- Índice para relatórios de produtividade por equipe.
create index inspections_team_captured_idx on public.inspections (team_id, captured_at desc);

-- Índice para relatórios de produtividade por agente.
create index inspections_agent_captured_idx on public.inspections (agent_id, captured_at desc);

-- Índice para encontrar rapidamente a escala ativa de um agente.
create index shift_agents_agent_period_idx on public.shift_agents (agent_id, starts_at, ends_at);

-- Índice usado pela rotina de limpeza das fotos expiradas.
create index inspection_photos_expiration_idx on public.inspection_photos (expires_at) where preserved = false and deleted_at is null;
