
-- Corrective Actions table
CREATE TABLE public.obra_acao_corretiva (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fase text,
  tipo_acao text NOT NULL CHECK (tipo_acao IN ('reducao_custo','troca_fornecedor','ajuste_cronograma','pedido_aditivo')),
  motivo text NOT NULL,
  analise_tecnica text NOT NULL,
  impacto_estimado numeric DEFAULT 0,
  nivel_urgencia text NOT NULL CHECK (nivel_urgencia IN ('baixo','medio','alto','critico')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','avaliando','aceita','rejeitada','executada')),
  decidido_por uuid,
  decidido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.obra_acao_corretiva ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Company members can view obra_acao_corretiva"
  ON public.obra_acao_corretiva FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can insert obra_acao_corretiva"
  ON public.obra_acao_corretiva FOR INSERT
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "Company members can update obra_acao_corretiva"
  ON public.obra_acao_corretiva FOR UPDATE
  USING (is_company_member(company_id));

-- Index
CREATE INDEX idx_obra_acao_corretiva_obra ON public.obra_acao_corretiva(obra_id);
CREATE INDEX idx_obra_acao_corretiva_status ON public.obra_acao_corretiva(status);
