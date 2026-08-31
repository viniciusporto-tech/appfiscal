-- =============================================================
-- 003_storage.sql
-- Antes de rodar, crie um bucket PRIVADO chamado inspection-photos.
-- =============================================================

drop policy if exists inspection_photos_owner_upload on storage.objects;
create policy inspection_photos_owner_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'inspection-photos'
  and exists (
    select 1 from public.inspections i
    where i.id::text = (storage.foldername(name))[1]
      and (i.agent_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists inspection_photos_owner_read on storage.objects;
create policy inspection_photos_owner_read
on storage.objects for select to authenticated
using (
  bucket_id = 'inspection-photos'
  and exists (
    select 1 from public.inspections i
    where i.id::text = (storage.foldername(name))[1]
      and (i.agent_id = auth.uid() or public.is_admin())
  )
);
