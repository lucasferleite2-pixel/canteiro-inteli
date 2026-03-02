
-- Create rdo_despesa_item table
CREATE TABLE public.rdo_despesa_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_dia_id uuid NOT NULL REFERENCES public.rdo_dia(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  tipo text NOT NULL DEFAULT 'material',
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  unidade text DEFAULT 'un',
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  centro_custo text,
  previsto_no_orcamento boolean DEFAULT true,
  incluir_no_pdf boolean DEFAULT true,
  afeta_curva_financeira boolean DEFAULT true,
  observacao text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rdo_despesa_item ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company members can view rdo_despesa_item"
  ON public.rdo_despesa_item FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can manage rdo_despesa_item"
  ON public.rdo_despesa_item FOR ALL
  USING (is_company_member(company_id))
  WITH CHECK (is_company_member(company_id));

-- Add constraint for tipo
ALTER TABLE public.rdo_despesa_item
  ADD CONSTRAINT rdo_despesa_item_tipo_check
  CHECK (tipo IN ('material', 'mao_de_obra', 'equipamento', 'transporte', 'outro'));
