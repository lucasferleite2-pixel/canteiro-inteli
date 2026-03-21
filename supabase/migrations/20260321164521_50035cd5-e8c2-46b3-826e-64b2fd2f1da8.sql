
-- Function to recalculate custo_dia from despesas + materiais
CREATE OR REPLACE FUNCTION public.sync_custo_dia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rdo_dia_id uuid;
  v_total_despesas numeric;
  v_total_materiais numeric;
BEGIN
  -- Determine which rdo_dia_id to update
  IF TG_OP = 'DELETE' THEN
    v_rdo_dia_id := OLD.rdo_dia_id;
  ELSE
    v_rdo_dia_id := NEW.rdo_dia_id;
  END IF;

  -- Sum despesas (only those affecting financial curve)
  SELECT COALESCE(SUM(quantidade * valor_unitario), 0)
  INTO v_total_despesas
  FROM public.rdo_despesa_item
  WHERE rdo_dia_id = v_rdo_dia_id
    AND afeta_curva_financeira = true;

  -- Sum materiais
  SELECT COALESCE(SUM(COALESCE(valor_total, 0)), 0)
  INTO v_total_materiais
  FROM public.rdo_material
  WHERE rdo_dia_id = v_rdo_dia_id;

  -- Update custo_dia
  UPDATE public.rdo_dia
  SET custo_dia = v_total_despesas + v_total_materiais,
      updated_at = now()
  WHERE id = v_rdo_dia_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on rdo_despesa_item
CREATE TRIGGER trg_sync_custo_dia_despesa
AFTER INSERT OR UPDATE OR DELETE ON public.rdo_despesa_item
FOR EACH ROW
EXECUTE FUNCTION public.sync_custo_dia();

-- Trigger on rdo_material
CREATE TRIGGER trg_sync_custo_dia_material
AFTER INSERT OR UPDATE OR DELETE ON public.rdo_material
FOR EACH ROW
EXECUTE FUNCTION public.sync_custo_dia();
