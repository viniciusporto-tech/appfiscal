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
