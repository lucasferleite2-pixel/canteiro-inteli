-- Tabela de auditoria de importações CSV de RDO com suporte a rollback
CREATE TABLE public.rdo_import_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  rdo_dia_id uuid REFERENCES public.rdo_dia(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  action text NOT NULL, -- 'created' | 'merged' | 'overwritten' | 'skipped'
  merge_mode text, -- 'preserve' | 'complement' | 'overwrite'
  field_changes jsonb DEFAULT '[]'::jsonb, -- [{field, old_value, new_value, action}]
  conflicts jsonb DEFAULT '[]'::jsonb, -- conflitos detectados
  origem text NOT NULL DEFAULT 'csv_import',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_rdo_import_log_batch ON public.rdo_import_log(batch_id);
CREATE INDEX idx_rdo_import_log_obra ON public.rdo_import_log(obra_id, created_at DESC);
CREATE INDEX idx_rdo_import_log_company ON public.rdo_import_log(company_id);

ALTER TABLE public.rdo_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view import log"
  ON public.rdo_import_log FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can insert import log"
  ON public.rdo_import_log FOR INSERT
  WITH CHECK (is_company_member(company_id) AND user_id = auth.uid());