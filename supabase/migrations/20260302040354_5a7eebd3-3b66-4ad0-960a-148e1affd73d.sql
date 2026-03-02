
-- Add integration columns to financial_records
ALTER TABLE public.financial_records
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS rdo_despesa_item_id uuid REFERENCES public.rdo_despesa_item(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_custo text,
  ADD COLUMN IF NOT EXISTS previsto_no_orcamento boolean DEFAULT true;

-- Add constraint for origem values
ALTER TABLE public.financial_records
  ADD CONSTRAINT financial_records_origem_check
  CHECK (origem IN ('manual', 'rdo', 'importacao'));

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_financial_records_origem ON public.financial_records(origem);
CREATE INDEX IF NOT EXISTS idx_financial_records_rdo_despesa ON public.financial_records(rdo_despesa_item_id) WHERE rdo_despesa_item_id IS NOT NULL;

-- Trigger function: sync rdo_despesa_item → financial_records
CREATE OR REPLACE FUNCTION public.sync_rdo_despesa_to_financeiro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obra_id uuid;
BEGIN
  -- On INSERT
  IF TG_OP = 'INSERT' THEN
    -- Only sync if afeta_curva_financeira is true
    IF NEW.afeta_curva_financeira = true THEN
      SELECT obra_id INTO v_obra_id FROM public.rdo_dia WHERE id = NEW.rdo_dia_id;
      
      INSERT INTO public.financial_records (
        company_id, project_id, description, amount, type, category,
        origem, rdo_despesa_item_id, centro_custo, previsto_no_orcamento
      ) VALUES (
        NEW.company_id,
        v_obra_id,
        NEW.descricao,
        NEW.quantidade * NEW.valor_unitario,
        'expense',
        CASE NEW.tipo
          WHEN 'material' THEN 'Material'
          WHEN 'mao_de_obra' THEN 'Mão de Obra'
          WHEN 'equipamento' THEN 'Equipamento'
          WHEN 'transporte' THEN 'Transporte'
          ELSE 'Outro'
        END,
        'rdo',
        NEW.id,
        NEW.centro_custo,
        NEW.previsto_no_orcamento
      );
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF NEW.afeta_curva_financeira = true THEN
      SELECT obra_id INTO v_obra_id FROM public.rdo_dia WHERE id = NEW.rdo_dia_id;
      
      -- Upsert: update existing or create new
      IF EXISTS (SELECT 1 FROM public.financial_records WHERE rdo_despesa_item_id = NEW.id) THEN
        UPDATE public.financial_records SET
          description = NEW.descricao,
          amount = NEW.quantidade * NEW.valor_unitario,
          category = CASE NEW.tipo
            WHEN 'material' THEN 'Material'
            WHEN 'mao_de_obra' THEN 'Mão de Obra'
            WHEN 'equipamento' THEN 'Equipamento'
            WHEN 'transporte' THEN 'Transporte'
            ELSE 'Outro'
          END,
          centro_custo = NEW.centro_custo,
          previsto_no_orcamento = NEW.previsto_no_orcamento,
          project_id = v_obra_id,
          updated_at = now()
        WHERE rdo_despesa_item_id = NEW.id;
      ELSE
        INSERT INTO public.financial_records (
          company_id, project_id, description, amount, type, category,
          origem, rdo_despesa_item_id, centro_custo, previsto_no_orcamento
        ) VALUES (
          NEW.company_id, v_obra_id, NEW.descricao,
          NEW.quantidade * NEW.valor_unitario, 'expense',
          CASE NEW.tipo
            WHEN 'material' THEN 'Material'
            WHEN 'mao_de_obra' THEN 'Mão de Obra'
            WHEN 'equipamento' THEN 'Equipamento'
            WHEN 'transporte' THEN 'Transporte'
            ELSE 'Outro'
          END,
          'rdo', NEW.id, NEW.centro_custo, NEW.previsto_no_orcamento
        );
      END IF;
    ELSE
      -- If afeta_curva_financeira turned off, remove the financial record
      DELETE FROM public.financial_records WHERE rdo_despesa_item_id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  -- On DELETE
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.financial_records WHERE rdo_despesa_item_id = OLD.id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Attach trigger
CREATE TRIGGER trg_sync_rdo_despesa_financeiro
  AFTER INSERT OR UPDATE OR DELETE ON public.rdo_despesa_item
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_rdo_despesa_to_financeiro();
