-- Fotos vencidas que podem ser removidas pela rotina automática.
create or replace view public.expired_inspection_photos as
select id, inspection_id, storage_path, expires_at
from public.inspection_photos
where preserved = false
  and deleted_at is null
  and expires_at is not null
  and expires_at <= now();
