import { supabase } from "@/integrations/supabase/client";
import type { ParsedRdoRow } from "./rdoCsvSchema";

export interface ImportOptions {
  duplicateStrategy: "skip" | "overwrite";
  obraId: string;
  companyId: string;
  userId: string;
}

export interface ImportResult {
  rowNumber: number;
  data: string;
  status: "created" | "overwritten" | "skipped" | "failed";
  error?: string;
  rdoId?: string;
}

export async function importRdoBatch(
  rows: ParsedRdoRow[],
  opts: ImportOptions,
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  // Pré-buscar RDOs existentes para detectar duplicatas
  const dates = rows.map((r) => r.data.rdo.data).filter(Boolean);
  const { data: existing } = await supabase
    .from("rdo_dia")
    .select("id, data")
    .eq("obra_id", opts.obraId)
    .in("data", dates);
  const existingMap = new Map<string, string>();
  (existing || []).forEach((e: any) => existingMap.set(e.data, e.id));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    onProgress?.(i + 1, rows.length);

    if (row.errors.length > 0) {
      results.push({
        rowNumber: row.rowNumber,
        data: row.data.rdo.data,
        status: "failed",
        error: row.errors.join("; "),
      });
      continue;
    }

    const existingId = existingMap.get(row.data.rdo.data);
    if (existingId && opts.duplicateStrategy === "skip") {
      results.push({
        rowNumber: row.rowNumber,
        data: row.data.rdo.data,
        status: "skipped",
        error: "RDO já existe nesta data",
      });
      continue;
    }

    try {
      let rdoId: string;

      if (existingId && opts.duplicateStrategy === "overwrite") {
        // Atualizar RDO + apagar sub-itens existentes
        const { error: upErr } = await supabase
          .from("rdo_dia")
          .update({
            clima: row.data.rdo.clima,
            fase_obra: row.data.rdo.fase_obra,
            risco_dia: row.data.rdo.risco_dia,
            equipe_total: row.data.rdo.equipe_total,
            horas_trabalhadas: row.data.rdo.horas_trabalhadas,
            percentual_fisico_dia: row.data.rdo.percentual_fisico_dia,
            percentual_fisico_acumulado: row.data.rdo.percentual_fisico_acumulado,
            quantidade_executada: row.data.rdo.quantidade_executada,
            unidade_medicao: row.data.rdo.unidade_medicao,
            produtividade_percentual: row.data.rdo.produtividade_percentual,
            custo_dia: row.data.rdo.custo_dia,
            observacoes_gerais: row.data.rdo.observacoes_gerais,
          })
          .eq("id", existingId);
        if (upErr) throw upErr;
        rdoId = existingId;

        // Limpar sub-itens
        await Promise.all([
          supabase.from("rdo_atividade").delete().eq("rdo_dia_id", rdoId),
          supabase.from("rdo_material").delete().eq("rdo_dia_id", rdoId),
          supabase.from("rdo_despesa_item").delete().eq("rdo_dia_id", rdoId),
          supabase.from("rdo_ocorrencia").delete().eq("rdo_dia_id", rdoId),
        ]);
      } else {
        // Criar novo
        const insertPayload: any = {
          obra_id: opts.obraId,
          company_id: opts.companyId,
          criado_por: opts.userId,
          data: row.data.rdo.data,
          clima: row.data.rdo.clima,
          fase_obra: row.data.rdo.fase_obra,
          risco_dia: row.data.rdo.risco_dia,
          equipe_total: row.data.rdo.equipe_total,
          horas_trabalhadas: row.data.rdo.horas_trabalhadas,
          percentual_fisico_dia: row.data.rdo.percentual_fisico_dia,
          percentual_fisico_acumulado: row.data.rdo.percentual_fisico_acumulado,
          quantidade_executada: row.data.rdo.quantidade_executada,
          unidade_medicao: row.data.rdo.unidade_medicao,
          produtividade_percentual: row.data.rdo.produtividade_percentual,
          custo_dia: row.data.rdo.custo_dia,
          observacoes_gerais: row.data.rdo.observacoes_gerais,
        };
        if (row.data.rdo.numero_sequencial) {
          insertPayload.numero_sequencial = row.data.rdo.numero_sequencial;
        }

        const { data: created, error: insErr } = await supabase
          .from("rdo_dia")
          .insert(insertPayload)
          .select("id")
          .single();
        if (insErr) throw insErr;
        rdoId = created.id;
      }

      // Inserir sub-itens
      const subItemTasks: Promise<any>[] = [];

      if (row.data.atividades.length > 0) {
        subItemTasks.push(
          supabase.from("rdo_atividade").insert(
            row.data.atividades.map((a) => ({
              ...a,
              rdo_dia_id: rdoId,
              company_id: opts.companyId,
            }))
          )
        );
      }
      if (row.data.materiais.length > 0) {
        subItemTasks.push(
          supabase.from("rdo_material").insert(
            row.data.materiais.map((m) => ({
              ...m,
              rdo_dia_id: rdoId,
              company_id: opts.companyId,
            }))
          )
        );
      }
      if (row.data.despesas.length > 0) {
        subItemTasks.push(
          supabase.from("rdo_despesa_item").insert(
            row.data.despesas.map((d) => ({
              ...d,
              rdo_dia_id: rdoId,
              company_id: opts.companyId,
              created_by: opts.userId,
            }))
          )
        );
      }
      if (row.data.ocorrencias.length > 0) {
        subItemTasks.push(
          supabase.from("rdo_ocorrencia").insert(
            row.data.ocorrencias.map((o) => ({
              ...o,
              rdo_dia_id: rdoId,
              company_id: opts.companyId,
            }))
          )
        );
      }

      const subResults = await Promise.all(subItemTasks);
      const subErr = subResults.find((r: any) => r?.error);
      if (subErr?.error) throw subErr.error;

      results.push({
        rowNumber: row.rowNumber,
        data: row.data.rdo.data,
        status: existingId ? "overwritten" : "created",
        rdoId,
      });
    } catch (err: any) {
      results.push({
        rowNumber: row.rowNumber,
        data: row.data.rdo.data,
        status: "failed",
        error: err.message || String(err),
      });
    }
  }

  return results;
}

export function buildErrorCsv(results: ImportResult[], originalRows: ParsedRdoRow[]): string {
  const failed = results.filter((r) => r.status === "failed");
  if (failed.length === 0) return "";

  const headers = ["linha", "data", "motivo_erro"];
  const lines = [headers.join(",")];
  failed.forEach((f) => {
    const row = originalRows.find((r) => r.rowNumber === f.rowNumber);
    const motivo = (f.error || "").replace(/"/g, '""');
    lines.push(`${f.rowNumber},"${f.data || row?.raw.data || ""}","${motivo}"`);
  });
  return lines.join("\n");
}
