import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Ruler, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DEMO_RDO_ENTRIES, DEMO_DESPESAS, DEMO_FASE_PLANEJAMENTO } from "@/lib/demoData";
import { Loader2 } from "lucide-react";

interface Props {
  obraId: string;
  companyId: string;
  rdos: any[];
}

interface FaseMetric {
  fase: string;
  unidade: string;
  qtdExecutada: number;
  custoAcumulado: number;
  custoPorUnidade: number;
  qtdPlanejada: number;
  custoPlanejado: number;
  custoPlanejadoPorUnidade: number;
  desvio: number;
  margemEstimada: number;
}

export function RdoPerformanceTab({ obraId, companyId, rdos }: Props) {
  const { isDemo } = useAuth();

  const { data: planejamento = [], isLoading: loadPlan } = useQuery({
    queryKey: ["obra_fase_planejamento", obraId],
    queryFn: async () => {
      if (isDemo) return DEMO_FASE_PLANEJAMENTO.filter((f) => f.obra_id === obraId);
      const { data, error } = await supabase
        .from("obra_fase_planejamento")
        .select("*")
        .eq("obra_id", obraId);
      if (error) throw error;
      return data;
    },
  });

  const { data: despesas = [], isLoading: loadDesp } = useQuery({
    queryKey: ["rdo_despesa_performance", obraId],
    queryFn: async () => {
      if (isDemo) {
        const rdoIds = DEMO_RDO_ENTRIES.filter((r) => r.obra_id === obraId).map((r) => r.id);
        return DEMO_DESPESAS.filter((d) => rdoIds.includes(d.rdo_dia_id) && d.afeta_curva_financeira);
      }
      const rdoIds = rdos.map((r: any) => r.id);
      if (rdoIds.length === 0) return [];
      const { data, error } = await supabase
        .from("rdo_despesa_item")
        .select("*, rdo_dia!inner(fase_obra)")
        .in("rdo_dia_id", rdoIds)
        .eq("afeta_curva_financeira", true);
      if (error) throw error;
      return data;
    },
    enabled: rdos.length > 0 || isDemo,
  });

  const metrics = useMemo((): FaseMetric[] => {
    const faseMap = new Map<string, { qtd: number; custo: number; unidade: string }>();

    rdos.forEach((r: any) => {
      const fase = r.fase_obra || "Sem fase";
      if (!faseMap.has(fase)) faseMap.set(fase, { qtd: 0, custo: 0, unidade: r.unidade_medicao || "m²" });
      const entry = faseMap.get(fase)!;
      entry.qtd += Number(r.quantidade_executada || 0);
      entry.custo += Number(r.custo_dia || 0);
    });

    // Add despesa costs per fase
    despesas.forEach((d: any) => {
      const fase = d.centro_custo || (d.rdo_dia as any)?.fase_obra || "Sem fase";
      if (faseMap.has(fase)) {
        // Already counted via custo_dia, skip to avoid double counting
      }
    });

    return Array.from(faseMap.entries()).map(([fase, data]) => {
      const plan = planejamento.find((p: any) => p.fase === fase);
      const custoPorUnidade = data.qtd > 0 ? data.custo / data.qtd : 0;
      const custoPlanejadoPorUnidade = plan && plan.quantidade_planejada > 0
        ? plan.custo_planejado / plan.quantidade_planejada : 0;
      const desvio = custoPlanejadoPorUnidade > 0
        ? ((custoPorUnidade - custoPlanejadoPorUnidade) / custoPlanejadoPorUnidade) * 100 : 0;
      const margemEstimada = plan && plan.custo_planejado > 0
        ? ((plan.custo_planejado - data.custo) / plan.custo_planejado) * 100 : 0;

      return {
        fase,
        unidade: plan?.unidade || data.unidade,
        qtdExecutada: data.qtd,
        custoAcumulado: data.custo,
        custoPorUnidade,
        qtdPlanejada: plan?.quantidade_planejada || 0,
        custoPlanejado: plan?.custo_planejado || 0,
        custoPlanejadoPorUnidade,
        desvio,
        margemEstimada,
      };
    });
  }, [rdos, despesas, planejamento]);

  if (loadPlan || loadDesp) {
    return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (metrics.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">Sem dados de execução para análise de performance.</p>;
  }

  const currFmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Ruler className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Custo por Unidade Executada</h3>
      </div>

      {metrics.map((m) => {
        const progressPct = m.qtdPlanejada > 0 ? Math.min(100, (m.qtdExecutada / m.qtdPlanejada) * 100) : 0;
        const overCost = m.desvio > 10;
        const lowProd = m.qtdPlanejada > 0 && progressPct < 30;

        return (
          <Card key={m.fase} className={overCost ? "border-destructive/30" : ""}>
            <CardContent className="pt-4 pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{m.fase}</span>
                  <Badge variant="outline" className="text-[10px]">{m.unidade}</Badge>
                </div>
                {overCost && (
                  <Badge variant="destructive" className="gap-1 text-[10px]">
                    <AlertTriangle className="h-3 w-3" /> Custo acima +{m.desvio.toFixed(0)}%
                  </Badge>
                )}
                {lowProd && !overCost && (
                  <Badge variant="outline" className="gap-1 text-[10px] border-orange-500/40 text-orange-600">
                    <TrendingDown className="h-3 w-3" /> Baixa produtividade
                  </Badge>
                )}
              </div>

              {/* Progress bar */}
              {m.qtdPlanejada > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Executado: {m.qtdExecutada.toLocaleString("pt-BR")} {m.unidade}</span>
                    <span>Planejado: {m.qtdPlanejada.toLocaleString("pt-BR")} {m.unidade}</span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                  <span className="text-[10px] text-muted-foreground">{progressPct.toFixed(1)}% concluído</span>
                </div>
              )}

              {/* Metrics grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="space-y-0.5">
                  <span className="text-muted-foreground">Custo Acumulado</span>
                  <p className="font-semibold">{currFmt(m.custoAcumulado)}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground">Custo/{m.unidade}</span>
                  <p className={`font-semibold ${overCost ? "text-destructive" : ""}`}>{currFmt(m.custoPorUnidade)}</p>
                </div>
                {m.custoPlanejadoPorUnidade > 0 && (
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground">Planejado/{m.unidade}</span>
                    <p className="font-semibold">{currFmt(m.custoPlanejadoPorUnidade)}</p>
                  </div>
                )}
                {m.custoPlanejado > 0 && (
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground">Margem Estimada</span>
                    <p className={`font-semibold flex items-center gap-1 ${m.margemEstimada >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {m.margemEstimada >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {m.margemEstimada.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
