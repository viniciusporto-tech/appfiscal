-- =============================================================
-- ARQUIVO 004: APOIO À RETENÇÃO DE FOTOS
-- IMPORTANTE: este SQL apenas identifica fotos vencidas.
-- A exclusão física do Storage deve ser feita pela API/Edge Function.
-- =============================================================

-- View que lista somente fotos que já passaram do prazo e não foram preservadas.
create or replace view public.expired_inspection_photos as
select
  id,
  inspection_id,
  storage_path,
  expires_at
from public.inspection_photos
where preserved = false
  and deleted_at is null
  and expires_at is not null
  and expires_at <= now();

-- Comentário operacional:
-- A Edge Function futura buscará esta view, apagará cada storage_path do bucket
-- "inspection-photos" e depois preencherá inspection_photos.deleted_at = now().
