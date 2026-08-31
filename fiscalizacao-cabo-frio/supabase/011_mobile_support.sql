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
