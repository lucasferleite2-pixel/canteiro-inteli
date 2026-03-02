/**
 * Prediction Engine — Budget Overrun Analysis
 *
 * Calculates projected final cost per phase using moving-average
 * cost-per-unit and planned quantities.  Designed to be swappable
 * with more advanced models (weighted regression, ARIMA, AI) in
 * the future.
 */

export interface PhaseProjection {
  fase: string;
  unidade: string;
  qtdExecutada: number;
  qtdPlanejada: number;
  custoReal: number;
  custoPlanejado: number;
  custoPorUnidadeAtual: number;
  custoPorUnidadePlanejado: number;
  custoProjetadoFinal: number;
  desvioPercentual: number;
  riscoEstouro: "baixo" | "medio" | "alto" | "critico";
  margemEstimada: number;
  modelo: string;
}

export interface ProjectionResult {
  phases: PhaseProjection[];
  custoRealTotal: number;
  custoPlanejadoTotal: number;
  custoProjetadoTotal: number;
  desvioGlobal: number;
  riscoGlobal: "baixo" | "medio" | "alto" | "critico";
  trendData: TrendPoint[];
}

export interface TrendPoint {
  label: string;
  planejado: number;
  real: number;
  projetado?: number;
}

// ── Risk classification ──

function classifyRisk(desvio: number): "baixo" | "medio" | "alto" | "critico" {
  if (desvio <= 3) return "baixo";
  if (desvio <= 8) return "medio";
  if (desvio <= 15) return "alto";
  return "critico";
}

// ── Moving average cost per unit (last N records) ──

function movingAvgCostPerUnit(
  records: { custo: number; qtd: number }[],
  window = 7
): number {
  const tail = records.slice(-window);
  const totalCost = tail.reduce((s, r) => s + r.custo, 0);
  const totalQtd = tail.reduce((s, r) => s + r.qtd, 0);
  return totalQtd > 0 ? totalCost / totalQtd : 0;
}

// ── Main calculation ──

export function calculateProjectionModel(
  rdos: any[],
  planejamento: any[]
): ProjectionResult {
  const sorted = [...rdos].sort((a, b) => a.data.localeCompare(b.data));

  // Group by phase
  const faseMap = new Map<
    string,
    { records: { custo: number; qtd: number }[]; unidade: string }
  >();

  sorted.forEach((r) => {
    const fase = r.fase_obra || "Sem fase";
    if (!faseMap.has(fase))
      faseMap.set(fase, { records: [], unidade: r.unidade_medicao || "m²" });
    faseMap.get(fase)!.records.push({
      custo: Number(r.custo_dia || 0),
      qtd: Number(r.quantidade_executada || 0),
    });
  });

  const phases: PhaseProjection[] = [];

  faseMap.forEach((data, fase) => {
    const plan = planejamento.find((p: any) => p.fase === fase);
    const qtdExecutada = data.records.reduce((s, r) => s + r.qtd, 0);
    const custoReal = data.records.reduce((s, r) => s + r.custo, 0);
    const qtdPlanejada = plan?.quantidade_planejada || 0;
    const custoPlanejado = plan?.custo_planejado || 0;

    const custoPorUnidadeAtual = movingAvgCostPerUnit(data.records);
    const custoPorUnidadePlanejado =
      qtdPlanejada > 0 ? custoPlanejado / qtdPlanejada : 0;

    // Project final cost: current avg cost × total planned qty
    const custoProjetadoFinal =
      qtdPlanejada > 0 ? custoPorUnidadeAtual * qtdPlanejada : custoReal;

    const desvioPercentual =
      custoPlanejado > 0
        ? ((custoProjetadoFinal - custoPlanejado) / custoPlanejado) * 100
        : 0;

    const margemEstimada =
      custoPlanejado > 0
        ? ((custoPlanejado - custoProjetadoFinal) / custoPlanejado) * 100
        : 0;

    phases.push({
      fase,
      unidade: plan?.unidade || data.unidade,
      qtdExecutada,
      qtdPlanejada,
      custoReal,
      custoPlanejado,
      custoPorUnidadeAtual,
      custoPorUnidadePlanejado,
      custoProjetadoFinal,
      desvioPercentual: Math.max(0, desvioPercentual),
      riscoEstouro: classifyRisk(Math.max(0, desvioPercentual)),
      margemEstimada,
      modelo: "regressao_linear",
    });
  });

  // Global totals
  const custoRealTotal = phases.reduce((s, p) => s + p.custoReal, 0);
  const custoPlanejadoTotal = phases.reduce((s, p) => s + p.custoPlanejado, 0);
  const custoProjetadoTotal = phases.reduce(
    (s, p) => s + p.custoProjetadoFinal,
    0
  );
  const desvioGlobal =
    custoPlanejadoTotal > 0
      ? ((custoProjetadoTotal - custoPlanejadoTotal) / custoPlanejadoTotal) * 100
      : 0;

  // Build trend data (cumulative by day)
  let cumPlan = 0;
  let cumReal = 0;
  const totalPlannedCost = custoPlanejadoTotal || 1;
  const avgDailyCost =
    sorted.length > 0 ? custoRealTotal / sorted.length : 0;

  const trendData: TrendPoint[] = sorted.map((r, i) => {
    cumReal += Number(r.custo_dia || 0);
    cumPlan = (totalPlannedCost / Math.max(sorted.length, 1)) * (i + 1);
    return {
      label: r.data.slice(5), // MM-DD
      planejado: Math.round(cumPlan),
      real: Math.round(cumReal),
    };
  });

  // Add projection points (extend 30% beyond current)
  if (sorted.length >= 2 && avgDailyCost > 0) {
    const extraDays = Math.max(3, Math.round(sorted.length * 0.3));
    for (let i = 1; i <= extraDays; i++) {
      const projected = cumReal + avgDailyCost * i;
      const planned =
        (totalPlannedCost / Math.max(sorted.length + extraDays, 1)) *
        (sorted.length + i);
      trendData.push({
        label: `+${i}d`,
        planejado: Math.round(planned),
        real: undefined as any,
        projetado: Math.round(projected),
      });
    }
  }

  return {
    phases,
    custoRealTotal,
    custoPlanejadoTotal,
    custoProjetadoTotal,
    desvioGlobal: Math.max(0, desvioGlobal),
    riscoGlobal: classifyRisk(Math.max(0, desvioGlobal)),
    trendData,
  };
}
