
-- Migrate diary_entries -> rdo_dia
-- Maps: project_id->obra_id, weather->clima, team_count->equipe_total, author_id->criado_por
-- activities/occurrences/materials go to observacoes_gerais as combined text
INSERT INTO public.rdo_dia (
  obra_id, company_id, data, clima, equipe_total, criado_por,
  is_locked, observacoes_gerais, created_at, updated_at
)
SELECT
  de.project_id,
  de.company_id,
  de.entry_date,
  CASE
    WHEN de.weather ILIKE '%ensolarado%' THEN 'Ensolarado'
    WHEN de.weather ILIKE '%nublado%' THEN 'Nublado'
    WHEN de.weather ILIKE '%chuv%' THEN 'Chuvoso'
    WHEN de.weather ILIKE '%tempestade%' THEN 'Tempestade'
    WHEN de.weather ILIKE '%neve%' OR de.weather ILIKE '%frio%' THEN 'Neve/Frio'
    ELSE COALESCE(de.weather, 'Ensolarado')
  END,
  COALESCE(de.team_count, 0),
  de.author_id,
  COALESCE(de.is_locked, false),
  CONCAT_WS(E'\n\n',
    CASE WHEN de.activities IS NOT NULL THEN '📋 ATIVIDADES: ' || de.activities END,
    CASE WHEN de.occurrences IS NOT NULL THEN '⚠️ OCORRÊNCIAS: ' || de.occurrences END,
    CASE WHEN de.materials IS NOT NULL THEN '📦 MATERIAIS: ' || de.materials END,
    CASE WHEN de.technical_comments IS NOT NULL THEN '🔧 COMENTÁRIOS TÉCNICOS: ' || de.technical_comments END
  ),
  de.created_at,
  de.updated_at
FROM public.diary_entries de
WHERE NOT EXISTS (
  SELECT 1 FROM public.rdo_dia rd
  WHERE rd.obra_id = de.project_id
    AND rd.data = de.entry_date
    AND rd.criado_por = de.author_id
);

-- Migrate diary_photos -> rdo_foto
-- Need to find the matching rdo_dia for each photo
INSERT INTO public.rdo_foto (
  rdo_dia_id, company_id, file_name, storage_path,
  descricao, uploaded_by, data_captura,
  latitude, longitude, created_at
)
SELECT
  rd.id,
  dp.company_id,
  dp.file_name,
  dp.storage_path,
  dp.description,
  dp.uploaded_by,
  dp.captured_at,
  dp.latitude,
  dp.longitude,
  dp.created_at
FROM public.diary_photos dp
INNER JOIN public.diary_entries de ON dp.diary_entry_id = de.id
INNER JOIN public.rdo_dia rd ON rd.obra_id = de.project_id
  AND rd.data = de.entry_date
  AND rd.criado_por = de.author_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.rdo_foto rf
  WHERE rf.storage_path = dp.storage_path
);
