
-- Add sequential number column
ALTER TABLE public.rdo_dia ADD COLUMN IF NOT EXISTS numero_sequencial integer;

-- Backfill existing records with sequential numbers per obra
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY obra_id ORDER BY data, created_at) AS seq
  FROM public.rdo_dia
)
UPDATE public.rdo_dia SET numero_sequencial = numbered.seq
FROM numbered WHERE rdo_dia.id = numbered.id;

-- Create trigger function to auto-assign sequential number on insert
CREATE OR REPLACE FUNCTION public.assign_rdo_numero_sequencial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  SELECT COALESCE(MAX(numero_sequencial), 0) + 1
  INTO NEW.numero_sequencial
  FROM public.rdo_dia
  WHERE obra_id = NEW.obra_id;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_rdo_numero_sequencial ON public.rdo_dia;
CREATE TRIGGER trg_rdo_numero_sequencial
  BEFORE INSERT ON public.rdo_dia
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_rdo_numero_sequencial();
