import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { DEMO_FASE_PLANEJAMENTO } from "@/lib/demoData";
import { calculateProjectionModel, type ProjectionResult } from "@/lib/projectionModel";
import { Loader2, TrendingUp, TrendingDown, ShieldAlert, BarChart3 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Props {
  rdos: any[];
  obraId: string;
  companyId: string;
}

const RISK_COLORS: Record<string, string> = {
  baixo: "hsl(152, 60%, 40%)",
  medio: "hsl(38, 92%, 50%)",
  alto: "hsl(24, 95%, 53%)",
  critico: "hsl(0, 72%, 51%)",
};

const RISK_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  baixo: "secondary",
  medio: "outline",
  alto: "destructive",
  critico: "destructive",
};

const currFmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function RdoProjectionPanel({ rdos, obraId, companyId }: Props) {
  const { isDemo } = useAuth();

  const { data: planejamento = [], isLoading } = useQuery({
    queryKey: ["obra_fase_planejamento_proj", obraId],
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

  const projection: ProjectionResult | null = useMemo(() => {
    if (!rdos.length || !planejamento.length) return null;
    return calculateProjectionModel(rdos, planejamento);
  }, [rdos, planejamento]);

  if (isLoading) {
    return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!projection || projection.phases.length === 0) return null;

  const criticalPhases = projection.phases.filter((p) => p.riscoEstouro === "alto" || p.riscoEstouro === "critico");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Análise Preditiva de Estouro
        </h3>
        <Badge
          variant={RISK_BADGE[projection.riscoGlobal]}
          className="text-xs gap-1"
          style={{ borderColor: RISK_COLORS[projection.riscoGlobal] }}
        >
          Risco {projection.riscoGlobal.toUpperCase()}
        </Badge>
      </div>

      {/* Smart alerts for critical phases */}
      {criticalPhases.map((p) => (
        <Alert key={p.fase} variant="destructive" className="border-destructive/30 bg-destructive/5">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">
            Tendência de estouro: {p.fase}
          </AlertTitle>
          <AlertDescription className="text-xs">
            Desvio projetado de +{p.desvioPercentual.toFixed(1)}% — custo projetado final {currFmt(p.custoProjetadoFinal)} vs planejado {currFmt(p.custoPlanejado)}.
            Classificação: <strong>{p.riscoEstouro.toUpperCase()}</strong>. Ação corretiva recomendada.
          </AlertDescription>
        </Alert>
      ))}

      {/* Global summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKpi label="Planejado Total" value={currFmt(projection.custoPlanejadoTotal)} />
        <MiniKpi label="Real Atual" value={currFmt(projection.custoRealTotal)} />
        <MiniKpi label="Projetado Final" value={currFmt(projection.custoProjetadoTotal)} color={RISK_COLORS[projection.riscoGlobal]} />
        <MiniKpi label="Desvio Global" value={`+${projection.desvioGlobal.toFixed(1)}%`} color={RISK_COLORS[projection.riscoGlobal]} />
      </div>

      {/* Phase detail table */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground">Projeção por Fase</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-2">Fase</th>
                  <th className="text-right py-2 px-2">Planejado</th>
                  <th className="text-right py-2 px-2">Real</th>
                  <th className="text-right py-2 px-2">Projetado</th>
                  <th className="text-right py-2 px-2">Desvio</th>
                  <th className="text-center py-2 pl-2">Risco</th>
                </tr>
              </thead>
              <tbody>
                {projection.phases.map((p) => (
                  <tr key={p.fase} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-medium">{p.fase}</td>
                    <td className="py-2 px-2 text-right">{currFmt(p.custoPlanejado)}</td>
                    <td className="py-2 px-2 text-right">{currFmt(p.custoReal)}</td>
                    <td className="py-2 px-2 text-right font-semibold">{currFmt(p.custoProjetadoFinal)}</td>
                    <td className="py-2 px-2 text-right" style={{ color: RISK_COLORS[p.riscoEstouro] }}>
                      <span className="flex items-center justify-end gap-0.5">
                        {p.desvioPercentual > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        +{p.desvioPercentual.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 pl-2 text-center">
                      <Badge
                        variant={RISK_BADGE[p.riscoEstouro]}
                        className="text-[10px] px-1.5"
                        style={p.riscoEstouro !== "baixo" ? { borderColor: RISK_COLORS[p.riscoEstouro], color: RISK_COLORS[p.riscoEstouro] } : {}}
                      >
                        {p.riscoEstouro.toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Trend chart */}
      {projection.trendData.length > 2 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Tendência: Planejado vs Real vs Projeção
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={projection.trendData}>
                <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis
                  hide={false}
                  tick={{ fontSize: 8 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  width={40}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: number, name: string) => [currFmt(v), name === "planejado" ? "Planejado" : name === "real" ? "Real" : "Projeção"]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(v) => v === "planejado" ? "Planejado" : v === "real" ? "Real" : "Projeção"}
                />
                <Line type="monotone" dataKey="planejado" stroke="hsl(210, 100%, 45%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="real" stroke="hsl(152, 60%, 40%)" strokeWidth={2} dot={false} />
                <Line
                  type="monotone"
                  dataKey="projetado"
                  stroke={RISK_COLORS[projection.riscoGlobal]}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MiniKpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <p className="text-lg font-bold" style={color ? { color } : {}}>{value}</p>
      </CardContent>
    </Card>
  );
}
