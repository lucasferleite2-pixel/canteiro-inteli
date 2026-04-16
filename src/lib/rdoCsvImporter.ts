import { supabase } from "@/integrations/supabase/client";
import type { ParsedRdoRow } from "./rdoCsvSchema";

export type MergeMode = "preserve" | "complement" | "overwrite";

export interface ImportOptions {
  mergeMode: MergeMode; // estratégia para duplicatas
  obraId: string;
  companyId: string;
  userId: string;
  batchId: string;
}

export interface FieldChange {
  field: string;
  old_value: any;
  new_value: any;
  action: "filled" | "kept_db" | "replaced" | "conflict_kept_db" | "conflict_used_csv";
}

export interface ImportResult {
  rowNumber: number;
  data: string;
  status: "created" | "merged" | "overwritten" | "skipped" | "failed";
  error?: string;
  rdoId?: string;
  fieldChanges?: FieldChange[];
  conflicts?: FieldChange[];
}

// Campos do rdo_dia que podem ser mesclados (não imutáveis)
const MERGEABLE_FIELDS = [
  "clima",
  "fase_obra",
  "risco_dia",
  "equipe_total",
  "horas_trabalhadas",
  "percentual_fisico_dia",
  "percentual_fisico_acumulado",
  "quantidade_executada",
  "unidade_medicao",
  "produtividade_percentual",
  "custo_dia",
  "observacoes_gerais",
] as const;

function isEmpty(v: any): boolean {
  return v === null || v === undefined || v === "" || (typeof v === "number" && isNaN(v));
}

/**
 * Calcula o diff entre o RDO existente no banco e o novo do CSV, conforme o modo de merge.
 * Retorna o payload final a ser aplicado e o log de mudanças/conflitos.
 */
export function computeMerge(
  dbRow: Record<string, any>,
  csvRow: Record<string, any>,
  mode: MergeMode
): { payload: Record<string, any>; changes: FieldChange[]; conflicts: FieldChange[] } {
  const payload: Record<string, any> = {};
  const changes: FieldChange[] = [];
  const conflicts: FieldChange[] = [];

  for (const field of MERGEABLE_FIELDS) {
    const dbVal = dbRow[field];
    const csvVal = csvRow[field];
    const dbEmpty = isEmpty(dbVal);
    const csvEmpty = isEmpty(csvVal);

    if (mode === "preserve") {
      // não toca em nada — não deve ser chamado, mas por segurança:
      continue;
    }

    if (mode === "complement") {
      if (dbEmpty && !csvEmpty) {
        payload[field] = csvVal;
        changes.push({ field, old_value: dbVal, new_value: csvVal, action: "filled" });
      } else if (!dbEmpty && !csvEmpty && String(dbVal) !== String(csvVal)) {
        // conflito real → mantém banco
        conflicts.push({ field, old_value: dbVal, new_value: csvVal, action: "conflict_kept_db" });
      }
      // demais casos: nada a fazer
      continue;
    }

    if (mode === "overwrite") {
      if (!csvEmpty && String(dbVal) !== String(csvVal)) {
        payload[field] = csvVal;
        if (!dbEmpty) {
          conflicts.push({ field, old_value: dbVal, new_value: csvVal, action: "conflict_used_csv" });
        }
        changes.push({
          field,
          old_value: dbVal,
          new_value: csvVal,
          action: dbEmpty ? "filled" : "replaced",
        });
      } else if (csvEmpty && !dbEmpty) {
        // CSV vazio → preserva banco (NUNCA vira NULL por omissão)
        changes.push({ field, old_value: dbVal, new_value: dbVal, action: "kept_db" });
      }
      continue;
    }
  }

  return { payload, changes, conflicts };
}

async function logImport(
  opts: ImportOptions,
  rdoId: string | null,
  action: ImportResult["status"],
  fieldChanges: FieldChange[],
  conflicts: FieldChange[]
) {
  await supabase.from("rdo_import_log").insert({
    company_id: opts.companyId,
    obra_id: opts.obraId,
    rdo_dia_id: rdoId,
    user_id: opts.userId,
    batch_id: opts.batchId,
    action,
    merge_mode: opts.mergeMode,
    field_changes: fieldChanges as any,
    conflicts: conflicts as any,
  });
}

export async function importRdoBatch(
  rows: ParsedRdoRow[],
  opts: ImportOptions,
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  // Pré-buscar RDOs existentes (linha completa) para detectar duplicatas e mesclar
  const dates = rows.map((r) => r.data.rdo.data).filter(Boolean);
  const { data: existing } = await supabase
    .from("rdo_dia")
    .select("*")
    .eq("obra_id", opts.obraId)
    .in("data", dates);
  const existingMap = new Map<string, any>();
  (existing || []).forEach((e: any) => existingMap.set(e.data, e));

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

    const dbRow = existingMap.get(row.data.rdo.data);

    // === MODO PRESERVAR: pular se já existe ===
    if (dbRow && opts.mergeMode === "preserve") {
      await logImport(opts, dbRow.id, "skipped", [], []);
      results.push({
        rowNumber: row.rowNumber,
        data: row.data.rdo.data,
        status: "skipped",
        error: "RDO já existe — preservado conforme estratégia",
        rdoId: dbRow.id,
      });
      continue;
    }

    try {
      let rdoId: string;
      let fieldChanges: FieldChange[] = [];
      let conflicts: FieldChange[] = [];
      let resultStatus: ImportResult["status"];

      if (dbRow) {
        // === MERGE: COMPLEMENTAR ou SOBRESCREVER ===
        const merge = computeMerge(dbRow, row.data.rdo, opts.mergeMode);
        fieldChanges = merge.changes;
        conflicts = merge.conflicts;
        rdoId = dbRow.id;

        if (Object.keys(merge.payload).length > 0) {
          const { error: upErr } = await supabase
            .from("rdo_dia")
            .update(merge.payload)
            .eq("id", rdoId);
          if (upErr) throw upErr;
        }

        // Sub-itens: SEMPRE adicionar (nunca apagar existentes em merge),
        // exceto em overwrite que limpa antes
        if (opts.mergeMode === "overwrite") {
          await Promise.all([
            supabase.from("rdo_atividade").delete().eq("rdo_dia_id", rdoId),
            supabase.from("rdo_material").delete().eq("rdo_dia_id", rdoId),
            supabase.from("rdo_despesa_item").delete().eq("rdo_dia_id", rdoId),
            supabase.from("rdo_ocorrencia").delete().eq("rdo_dia_id", rdoId),
          ]);
        }

        resultStatus = opts.mergeMode === "overwrite" ? "overwritten" : "merged";
      } else {
        // === CRIAR NOVO ===
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
        resultStatus = "created";

        // Registrar todos os campos preenchidos como changes
        for (const field of MERGEABLE_FIELDS) {
          const v = (row.data.rdo as any)[field];
          if (!isEmpty(v)) {
            fieldChanges.push({ field, old_value: null, new_value: v, action: "filled" });
          }
        }
      }

      // === Inserir sub-itens (atividades, materiais, despesas, ocorrências) ===
      if (row.data.atividades.length > 0) {
        const { error } = await supabase.from("rdo_atividade").insert(
          row.data.atividades.map((a) => ({ ...a, rdo_dia_id: rdoId, company_id: opts.companyId }))
        );
        if (error) throw error;
      }
      if (row.data.materiais.length > 0) {
        const { error } = await supabase.from("rdo_material").insert(
          row.data.materiais.map((m) => ({ ...m, rdo_dia_id: rdoId, company_id: opts.companyId }))
        );
        if (error) throw error;
      }
      if (row.data.despesas.length > 0) {
        const { error } = await supabase.from("rdo_despesa_item").insert(
          row.data.despesas.map((d) => ({
            ...d,
            rdo_dia_id: rdoId,
            company_id: opts.companyId,
            created_by: opts.userId,
          }))
        );
        if (error) throw error;
      }
      if (row.data.ocorrencias.length > 0) {
        const { error } = await supabase.from("rdo_ocorrencia").insert(
          row.data.ocorrencias.map((o) => ({ ...o, rdo_dia_id: rdoId, company_id: opts.companyId }))
        );
        if (error) throw error;
      }

      await logImport(opts, rdoId, resultStatus, fieldChanges, conflicts);

      results.push({
        rowNumber: row.rowNumber,
        data: row.data.rdo.data,
        status: resultStatus,
        rdoId,
        fieldChanges,
        conflicts,
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

/**
 * Calcula o diff prévio (sem aplicar) para cada linha conflitante.
 * Usado pela UI para mostrar a tabela "antes × depois".
 */
export async function computeDiffPreview(
  rows: ParsedRdoRow[],
  obraId: string,
  mode: MergeMode
): Promise<Map<string, { dbRow: any; changes: FieldChange[]; conflicts: FieldChange[] }>> {
  const dates = rows.map((r) => r.data.rdo.data).filter(Boolean);
  const result = new Map<string, { dbRow: any; changes: FieldChange[]; conflicts: FieldChange[] }>();
  if (dates.length === 0) return result;

  const { data: existing } = await supabase
    .from("rdo_dia")
    .select("*")
    .eq("obra_id", obraId)
    .in("data", dates);
  const existingMap = new Map<string, any>();
  (existing || []).forEach((e: any) => existingMap.set(e.data, e));

  for (const row of rows) {
    const dbRow = existingMap.get(row.data.rdo.data);
    if (!dbRow) continue;
    if (mode === "preserve") {
      result.set(row.data.rdo.data, { dbRow, changes: [], conflicts: [] });
    } else {
      const diff = computeMerge(dbRow, row.data.rdo, mode);
      result.set(row.data.rdo.data, { dbRow, changes: diff.changes, conflicts: diff.conflicts });
    }
  }
  return result;
}

/**
 * Reverte uma importação inteira pelo batch_id, restaurando os valores anteriores
 * e apagando os RDOs criados nessa importação.
 */
export async function rollbackImport(batchId: string): Promise<{ restored: number; deleted: number; failed: number }> {
  const { data: logs, error } = await supabase
    .from("rdo_import_log")
    .select("*")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: false });

  if (error || !logs) return { restored: 0, deleted: 0, failed: 0 };

  let restored = 0;
  let deleted = 0;
  let failed = 0;

  for (const log of logs as any[]) {
    try {
      if (log.action === "created" && log.rdo_dia_id) {
        // Apagar RDO criado nesta importação (cascade nos sub-itens? não temos FK cascade,
        // então apagamos sub-itens primeiro)
        await Promise.all([
          supabase.from("rdo_atividade").delete().eq("rdo_dia_id", log.rdo_dia_id),
          supabase.from("rdo_material").delete().eq("rdo_dia_id", log.rdo_dia_id),
          supabase.from("rdo_despesa_item").delete().eq("rdo_dia_id", log.rdo_dia_id),
          supabase.from("rdo_ocorrencia").delete().eq("rdo_dia_id", log.rdo_dia_id),
        ]);
        const { error: delErr } = await supabase.from("rdo_dia").delete().eq("id", log.rdo_dia_id);
        if (delErr) throw delErr;
        deleted++;
      } else if ((log.action === "merged" || log.action === "overwritten") && log.rdo_dia_id) {
        // Restaurar valores antigos a partir do field_changes
        const restorePayload: Record<string, any> = {};
        for (const ch of (log.field_changes || []) as FieldChange[]) {
          if (ch.action === "filled" || ch.action === "replaced" || ch.action === "conflict_used_csv") {
            restorePayload[ch.field] = ch.old_value;
          }
        }
        if (Object.keys(restorePayload).length > 0) {
          const { error: upErr } = await supabase
            .from("rdo_dia")
            .update(restorePayload)
            .eq("id", log.rdo_dia_id);
          if (upErr) throw upErr;
        }
        restored++;
      }
    } catch (e) {
      failed++;
    }
  }

  return { restored, deleted, failed };
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
