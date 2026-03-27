
ALTER TABLE public.rdo_despesa_item ADD COLUMN IF NOT EXISTS fase text DEFAULT NULL;
ALTER TABLE public.rdo_atividade ADD COLUMN IF NOT EXISTS fase text DEFAULT NULL;
