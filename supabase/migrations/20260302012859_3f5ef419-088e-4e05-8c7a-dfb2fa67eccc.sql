
-- =============================================
-- RDO 2.0 - Phase 1: Data Structure
-- =============================================

-- 1. RDO_DIA (Daily Report)
CREATE TABLE public.rdo_dia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  clima TEXT NOT NULL DEFAULT 'Ensolarado',
  equipe_total INTEGER NOT NULL DEFAULT 0,
  horas_trabalhadas NUMERIC(5,2) DEFAULT 0,
  fase_obra TEXT DEFAULT 'Fundação',
  percentual_fisico_dia NUMERIC(5,2) DEFAULT 0,
  percentual_fisico_acumulado NUMERIC(5,2) DEFAULT 0,
  custo_dia NUMERIC(12,2) DEFAULT 0,
  produtividade_percentual NUMERIC(5,2) DEFAULT 0,
  risco_dia TEXT DEFAULT 'baixo',
  observacoes_gerais TEXT,
  criado_por UUID NOT NULL,
  hash_integridade TEXT,
  is_locked BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(obra_id, data)
);

ALTER TABLE public.rdo_dia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view rdo_dia"
  ON public.rdo_dia FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can create rdo_dia"
  ON public.rdo_dia FOR INSERT
  WITH CHECK (is_company_member(company_id) AND criado_por = auth.uid());

CREATE POLICY "Authors can update unlocked rdo_dia"
  ON public.rdo_dia FOR UPDATE
  USING (criado_por = auth.uid() AND is_locked = false);

CREATE POLICY "Authors can delete unlocked rdo_dia"
  ON public.rdo_dia FOR DELETE
  USING (criado_por = auth.uid() AND is_locked = false);

CREATE TRIGGER update_rdo_dia_updated_at
  BEFORE UPDATE ON public.rdo_dia
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. RDO_ATIVIDADE (Activities)
CREATE TABLE public.rdo_atividade (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_dia_id UUID NOT NULL REFERENCES public.rdo_dia(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  tipo_atividade TEXT NOT NULL DEFAULT 'Execução',
  vinculada_ao_planejamento BOOLEAN DEFAULT false,
  etapa_planejamento_id UUID,
  impacto_cronograma TEXT DEFAULT 'nenhum',
  concluida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rdo_atividade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view rdo_atividade"
  ON public.rdo_atividade FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can manage rdo_atividade"
  ON public.rdo_atividade FOR ALL
  USING (is_company_member(company_id))
  WITH CHECK (is_company_member(company_id));

-- 3. RDO_MATERIAL (Materials & Costs)
CREATE TABLE public.rdo_material (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_dia_id UUID NOT NULL REFERENCES public.rdo_dia(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'Consumo',
  item TEXT NOT NULL,
  quantidade NUMERIC(12,3) DEFAULT 0,
  unidade TEXT DEFAULT 'un',
  valor_unitario NUMERIC(12,2) DEFAULT 0,
  valor_total NUMERIC(12,2) DEFAULT 0,
  centro_custo TEXT,
  fase_relacionada TEXT,
  previsto_em_orcamento BOOLEAN DEFAULT true,
  gera_alerta_desequilibrio BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rdo_material ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view rdo_material"
  ON public.rdo_material FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can manage rdo_material"
  ON public.rdo_material FOR ALL
  USING (is_company_member(company_id))
  WITH CHECK (is_company_member(company_id));

-- 4. RDO_OCORRENCIA (Occurrences)
CREATE TABLE public.rdo_ocorrencia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_dia_id UUID NOT NULL REFERENCES public.rdo_dia(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo_ocorrencia TEXT NOT NULL DEFAULT 'Técnica',
  descricao TEXT NOT NULL,
  impacto TEXT DEFAULT 'baixo',
  responsavel TEXT,
  gera_risco_contratual BOOLEAN DEFAULT false,
  gera_alerta BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rdo_ocorrencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view rdo_ocorrencia"
  ON public.rdo_ocorrencia FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can manage rdo_ocorrencia"
  ON public.rdo_ocorrencia FOR ALL
  USING (is_company_member(company_id))
  WITH CHECK (is_company_member(company_id));

-- 5. RDO_FOTO (Photos)
CREATE TABLE public.rdo_foto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_dia_id UUID NOT NULL REFERENCES public.rdo_dia(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  atividade_relacionada_id UUID REFERENCES public.rdo_atividade(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  descricao TEXT,
  fase_obra TEXT,
  tag_risco TEXT DEFAULT 'nenhuma',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  data_captura TIMESTAMPTZ DEFAULT now(),
  hash_integridade TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rdo_foto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view rdo_foto"
  ON public.rdo_foto FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can insert rdo_foto"
  ON public.rdo_foto FOR INSERT
  WITH CHECK (is_company_member(company_id) AND uploaded_by = auth.uid());

CREATE POLICY "Authors can delete own rdo_foto"
  ON public.rdo_foto FOR DELETE
  USING (uploaded_by = auth.uid());

-- 6. RDO_AUDIT_LOG (Change tracking)
CREATE TABLE public.rdo_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_dia_id UUID NOT NULL REFERENCES public.rdo_dia(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  changes JSONB,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rdo_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view rdo_audit_log"
  ON public.rdo_audit_log FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Company members can insert rdo_audit_log"
  ON public.rdo_audit_log FOR INSERT
  WITH CHECK (is_company_member(company_id) AND user_id = auth.uid());

-- 7. Indexes for performance
CREATE INDEX idx_rdo_dia_obra_data ON public.rdo_dia(obra_id, data);
CREATE INDEX idx_rdo_dia_company ON public.rdo_dia(company_id);
CREATE INDEX idx_rdo_atividade_rdo_dia ON public.rdo_atividade(rdo_dia_id);
CREATE INDEX idx_rdo_material_rdo_dia ON public.rdo_material(rdo_dia_id);
CREATE INDEX idx_rdo_ocorrencia_rdo_dia ON public.rdo_ocorrencia(rdo_dia_id);
CREATE INDEX idx_rdo_foto_rdo_dia ON public.rdo_foto(rdo_dia_id);
CREATE INDEX idx_rdo_audit_log_rdo_dia ON public.rdo_audit_log(rdo_dia_id);
