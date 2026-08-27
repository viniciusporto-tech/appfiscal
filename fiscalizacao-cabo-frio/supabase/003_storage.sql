-- =============================================================
-- ARQUIVO 003: STORAGE PRIVADO DAS FOTOS
-- Execute após criar o bucket privado "inspection-photos" no Supabase Storage.
-- =============================================================

-- Permite upload somente quando a primeira pasta do caminho é uma fiscalização do próprio agente.
-- O frontend salva arquivos no formato: <inspection_id>/<arquivo>.jpg
create policy "inspection_photos_owner_upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'inspection-photos'
  and exists (
    select 1
    from public.inspections i
    where i.id::text = (storage.foldername(name))[1]
      and (i.agent_id = auth.uid() or public.is_admin())
  )
);

-- O agente lê apenas imagens de fiscalizações próprias; administrador pode ler todas.
create policy "inspection_photos_owner_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'inspection-photos'
  and exists (
    select 1
    from public.inspections i
    where i.id::text = (storage.foldername(name))[1]
      and (i.agent_id = auth.uid() or public.is_admin())
  )
);

-- A exclusão física das fotos expiradas será realizada no servidor/Edge Function.
-- A credencial administrativa nunca será exposta no PWA.
