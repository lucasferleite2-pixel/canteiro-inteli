
-- Add quantidade_executada and unidade_medicao to rdo_dia
ALTER TABLE public.rdo_dia
  ADD COLUMN IF NOT EXISTS quantidade_executada numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unidade_medicao text DEFAULT 'm²';

-- Create obra_fase_planejamento table
CREATE TABLE public.obra_fase_planejamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  fase text NOT NULL,
  quantidade_planejada numeric NOT NULL DEFAULT 0,
  custo_planejado numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'm²',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.obra_fase_planejamento ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company members can view obra_fase_planejamento"
  ON public.obra_fase_planejamento FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can manage obra_fase_planejamento"
  ON public.obra_fase_planejamento FOR ALL
  USING (is_company_member(company_id))
  WITH CHECK (is_company_member(company_id));

-- Index for performance
CREATE INDEX idx_obra_fase_planejamento_obra ON public.obra_fase_planejamento(obra_id);
CREATE INDEX idx_obra_fase_planejamento_fase ON public.obra_fase_planejamento(fase);

-- Updated_at trigger
CREATE TRIGGER update_obra_fase_planejamento_updated_at
  BEFORE UPDATE ON public.obra_fase_planejamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
