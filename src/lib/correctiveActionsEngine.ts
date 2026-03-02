/**
 * Corrective Actions Decision Engine
 * 
 * Analyses projections, cost/unit, unplanned expenses, productivity,
 * and schedule to generate corrective action suggestions.
 */

import type { ProjectionResult, PhaseProjection } from "./projectionModel";

export interface CorrectiveAction {
  id: string;
  fase: string;
  tipo_acao: "reducao_custo" | "troca_fornecedor" | "ajuste_cronograma" | "pedido_aditivo";
  motivo: string;
  analise_tecnica: string;
  impacto_estimado: number;
  nivel_urgencia: "baixo" | "medio" | "alto" | "critico";
}

const TIPO_LABELS: Record<string, string> = {
  reducao_custo: "Redução de Custo",
  troca_fornecedor: "Troca de Fornecedor",
  ajuste_cronograma: "Ajuste de Cronograma",
  pedido_aditivo: "Pedido de Aditivo",
};

export { TIPO_LABELS };

let _counter = 0;
const uid = () => `ca-${++_counter}`;

/**
 * Main entry point — generates corrective actions based on project data
 */
export function generateCorrectiveActions(
  projection: ProjectionResult | null,
  rdos: any[],
  despesas: any[],
  obraOrcamento?: number
): CorrectiveAction[] {
  _counter = 0;
  const actions: CorrectiveAction[] = [];

  if (!projection || !projection.phases.length) return actions;

  for (const phase of projection.phases) {
    // RULE 1 — Cost reduction
    checkCostReduction(phase, actions);

    // RULE 2 — Supplier change  
    checkSupplierChange(phase, despesas, actions);

    // RULE 3 — Schedule adjustment
    checkScheduleAdjustment(phase, rdos, actions);

    // RULE 4 — Contract addendum
    checkContractAddendum(phase, obraOrcamento, actions);
  }

  return actions;
}

function checkCostReduction(phase: PhaseProjection, actions: CorrectiveAction[]) {
  if (phase.custoPlanejado <= 0 || phase.qtdPlanejada <= 0) return;

  const ratio = phase.custoPorUnidadeAtual / phase.custoPorUnidadePlanejado;
  const execPercent = (phase.qtdExecutada / phase.qtdPlanejada) * 100;

  if (ratio > 1.12 && execPercent < 60) {
    const desvio = (ratio - 1) * 100;
    actions.push({
      id: uid(),
      fase: phase.fase,
      tipo_acao: "reducao_custo",
      motivo: `Custo por ${phase.unidade} está ${desvio.toFixed(1)}% acima do planejado (R$ ${phase.custoPorUnidadeAtual.toFixed(2)} vs R$ ${phase.custoPorUnidadePlanejado.toFixed(2)}).`,
      analise_tecnica: `A fase "${phase.fase}" apresenta custo por ${phase.unidade} de R$ ${phase.custoPorUnidadeAtual.toFixed(2)}, superior ao planejado de R$ ${phase.custoPorUnidadePlanejado.toFixed(2)} (+${desvio.toFixed(1)}%). Com apenas ${execPercent.toFixed(0)}% da quantidade executada, há margem para correção. Recomenda-se:\n\n1. Revisar consumo de material e identificar desperdícios\n2. Avaliar produtividade da equipe\n3. Verificar se há insumos com preço acima do mercado\n4. Considerar otimização de processos executivos`,
      impacto_estimado: phase.custoProjetadoFinal - phase.custoPlanejado,
      nivel_urgencia: desvio > 10 ? "alto" : "medio",
    });
  }
}

function checkSupplierChange(
  phase: PhaseProjection,
  despesas: any[],
  actions: CorrectiveAction[]
) {
  if (phase.custoPlanejado <= 0) return;

  // Count unplanned expenses for this phase
  const faseDespesas = despesas.filter(
    (d) => (d.centro_custo === phase.fase || d.fase_relacionada === phase.fase)
  );
  const naoPrevistos = faseDespesas.filter((d) => d.previsto_no_orcamento === false || d.previsto_em_orcamento === false);
  const totalNaoPrevisto = naoPrevistos.reduce((s: number, d: any) => s + (Number(d.valor_total) || 0), 0);
  const percentNaoPrevisto = (totalNaoPrevisto / phase.custoPlanejado) * 100;

  if (percentNaoPrevisto > 8) {
    actions.push({
      id: uid(),
      fase: phase.fase,
      tipo_acao: "troca_fornecedor",
      motivo: `Despesas não previstas representam ${percentNaoPrevisto.toFixed(1)}% do custo planejado da fase (R$ ${totalNaoPrevisto.toLocaleString("pt-BR")}).`,
      analise_tecnica: `A fase "${phase.fase}" acumula R$ ${totalNaoPrevisto.toLocaleString("pt-BR")} em despesas não previstas no orçamento original, equivalente a ${percentNaoPrevisto.toFixed(1)}% do custo planejado. Isso pode indicar:\n\n1. Fornecedor atual com preços acima da média\n2. Condições imprevistas gerando custos extras\n3. Falta de planejamento de contingência\n\nRecomenda-se:\n- Cotação com fornecedores alternativos\n- Renegociação de contratos vigentes\n- Avaliação de substitutos técnicos de menor custo`,
      impacto_estimado: totalNaoPrevisto,
      nivel_urgencia: percentNaoPrevisto > 15 ? "alto" : "medio",
    });
  }
}

function checkScheduleAdjustment(
  phase: PhaseProjection,
  rdos: any[],
  actions: CorrectiveAction[]
) {
  if (phase.qtdPlanejada <= 0) return;

  const execPercent = (phase.qtdExecutada / phase.qtdPlanejada) * 100;
  const phaseRdos = rdos.filter((r) => r.fase_obra === phase.fase);
  const avgProd = phaseRdos.length > 0
    ? phaseRdos.reduce((s: number, r: any) => s + (Number(r.produtividade_percentual) || 0), 0) / phaseRdos.length
    : 100;

  // Low productivity + significant remaining work
  if (avgProd < 85 && execPercent < 70) {
    actions.push({
      id: uid(),
      fase: phase.fase,
      tipo_acao: "ajuste_cronograma",
      motivo: `Produtividade média de ${avgProd.toFixed(0)}% (abaixo de 85%) com ${(100 - execPercent).toFixed(0)}% da quantidade ainda pendente.`,
      analise_tecnica: `A fase "${phase.fase}" apresenta produtividade física média de ${avgProd.toFixed(0)}%, abaixo da meta de 85%. Com ${execPercent.toFixed(0)}% executado e ${(100 - execPercent).toFixed(0)}% restante, há risco de atraso significativo.\n\nSugestões:\n1. Reforço de equipe para acelerar execução\n2. Replanejamento de sequência executiva\n3. Paralelização de frentes de trabalho\n4. Revisão de metas de produtividade diária\n5. Avaliação de turnos adicionais`,
      impacto_estimado: phase.custoProjetadoFinal * 0.05, // ~5% overhead
      nivel_urgencia: avgProd < 60 ? "alto" : "medio",
    });
  }
}

function checkContractAddendum(
  phase: PhaseProjection,
  obraOrcamento: number | undefined,
  actions: CorrectiveAction[]
) {
  if (phase.custoPlanejado <= 0) return;

  const ratio = phase.custoProjetadoFinal / phase.custoPlanejado;

  if (ratio > 1.15 && phase.riscoEstouro !== "baixo") {
    const desvio = (ratio - 1) * 100;
    actions.push({
      id: uid(),
      fase: phase.fase,
      tipo_acao: "pedido_aditivo",
      motivo: `Projeção final excede orçamento em ${desvio.toFixed(1)}% — necessidade de aditivo contratual.`,
      analise_tecnica: `A fase "${phase.fase}" tem custo projetado final de R$ ${phase.custoProjetadoFinal.toLocaleString("pt-BR")}, representando desvio de +${desvio.toFixed(1)}% sobre o planejado de R$ ${phase.custoPlanejado.toLocaleString("pt-BR")}.\n\n**Fundamentação para Aditivo:**\n- Custo real atual: R$ ${phase.custoReal.toLocaleString("pt-BR")}\n- Custo por ${phase.unidade}: R$ ${phase.custoPorUnidadeAtual.toFixed(2)} (planejado: R$ ${phase.custoPorUnidadePlanejado.toFixed(2)})\n- Desvio projetado: +${desvio.toFixed(1)}%\n- Classificação de risco: ${phase.riscoEstouro.toUpperCase()}\n\n**Base contratual:** Art. 65, Lei 8.666/93 — alteração por fatos supervenientes que tornem o contrato excessivamente oneroso.\n\n**Impacto de não agir:** Comprometimento da margem e risco de paralisação parcial.`,
      impacto_estimado: phase.custoProjetadoFinal - phase.custoPlanejado,
      nivel_urgencia: "critico",
    });
  }
}

/**
 * Compute global strategic risk level
 */
export function computeStrategicRisk(
  actions: CorrectiveAction[],
  projection: ProjectionResult | null
): "estavel" | "atencao" | "risco_elevado" | "critico" {
  const pending = actions.filter((a) => a.nivel_urgencia === "critico" || a.nivel_urgencia === "alto");
  const desvio = projection?.desvioGlobal || 0;

  if (pending.length >= 2 || desvio > 15) return "critico";
  if (pending.length >= 1 || desvio > 8) return "risco_elevado";
  if (actions.length > 0 || desvio > 3) return "atencao";
  return "estavel";
}

export const STRATEGIC_RISK_CONFIG = {
  estavel: { label: "Estável", color: "hsl(152, 60%, 40%)", emoji: "🟢" },
  atencao: { label: "Atenção", color: "hsl(38, 92%, 50%)", emoji: "🟡" },
  risco_elevado: { label: "Risco Elevado", color: "hsl(24, 95%, 53%)", emoji: "🟠" },
  critico: { label: "Crítico", color: "hsl(0, 72%, 51%)", emoji: "🔴" },
};
