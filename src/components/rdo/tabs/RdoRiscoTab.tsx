import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldAlert, TrendingDown, AlertTriangle, DollarSign, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Props {
  rdoDiaId: string;
  companyId: string;
  rdo: {
    produtividade_percentual: number;
    risco_dia: string;
    custo_dia: number;
    horas_trabalhadas: number;
    equipe_total: number;
  };
}

export function RdoRiscoTab({ rdoDiaId, companyId, rdo }: Props) {
  const { data: ocorrencias = [], isLoading: loadingOc } = useQuery({
    queryKey: ["rdo_ocorrencia", rdoDiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rdo_ocorrencia")
        .select("*")
        .eq("rdo_dia_id", rdoDiaId);
      if (error) throw error;
      return data;
    },
  });

  const { data: materiais = [], isLoading: loadingMat } = useQuery({
    queryKey: ["rdo_material", rdoDiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rdo_material")
        .select("*")
        .eq("rdo_dia_id", rdoDiaId);
      if (error) throw error;
      return data;
    },
  });

  if (loadingOc || loadingMat) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const riscoContratual = ocorrencias.filter((o: any) => o.gera_risco_contratual);
  const ocAltas = ocorrencias.filter((o: any) => o.impacto === "alto" || o.impacto === "crítico");
  const matNaoPrevisto = materiais.filter((m: any) => !m.previsto_em_orcamento);
  const custoNaoPrevisto = matNaoPrevisto.reduce((s: number, m: any) => s + Number(m.valor_total || 0), 0);
  const prod = rdo.produtividade_percentual;

  const alerts: { icon: any; label: string; level: "info" | "warn" | "danger" }[] = [];

  if (prod > 0 && prod < 50) alerts.push({ icon: TrendingDown, label: `Produtividade crítica: ${prod}%`, level: "danger" });
  else if (prod > 0 && prod < 70) alerts.push({ icon: TrendingDown, label: `Produtividade baixa: ${prod}%`, level: "warn" });

  if (riscoContratual.length > 0) alerts.push({ icon: ShieldAlert, label: `${riscoContratual.length} ocorrência(s) com risco contratual`, level: "danger" });
  if (ocAltas.length > 0) alerts.push({ icon: AlertTriangle, label: `${ocAltas.length} ocorrência(s) de alto impacto`, level: "warn" });
  if (custoNaoPrevisto > 0) alerts.push({ icon: DollarSign, label: `R$ ${custoNaoPrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em custos não previstos`, level: "warn" });

  const levelColors = {
    info: "border-blue-500/30 bg-blue-500/5",
    warn: "border-yellow-500/30 bg-yellow-500/5",
    danger: "border-red-500/30 bg-red-500/5",
  };
  const iconColors = { info: "text-blue-500", warn: "text-yellow-500", danger: "text-red-500" };

  return (
    <div className="space-y-4">
      {/* Productivity gauge */}
      <Card>
        <CardContent className="pt-4 pb-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-medium"><Activity className="h-4 w-4" /> Produtividade</span>
            <span className="font-semibold">{prod > 0 ? `${prod}%` : "N/A"}</span>
          </div>
          {prod > 0 && (
            <Progress value={prod} className="h-2" />
          )}
          <p className="text-xs text-muted-foreground">
            {prod >= 70 ? "✅ Dentro do esperado" : prod >= 50 ? "⚠️ Abaixo do ideal — investigar causas" : prod > 0 ? "🔴 Crítico — ação corretiva necessária" : "Sem dados de produtividade"}
          </p>
        </CardContent>
      </Card>

      {/* Risk summary */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Nível de risco do dia:</span>
        <Badge className={`
          ${rdo.risco_dia === "alto" ? "bg-red-500/15 text-red-700 dark:text-red-400" : ""}
          ${rdo.risco_dia === "médio" || rdo.risco_dia === "medio" ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" : ""}
          ${rdo.risco_dia === "baixo" ? "bg-green-500/15 text-green-700 dark:text-green-400" : ""}
        `}>
          {rdo.risco_dia}
        </Badge>
      </div>

      {/* Alert cards */}
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-3">✅ Nenhum alerta de risco identificado para este dia.</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={i} className={`flex items-center gap-2 p-2.5 rounded-md border ${levelColors[a.level]}`}>
                <Icon className={`h-4 w-4 shrink-0 ${iconColors[a.level]}`} />
                <span className="text-sm">{a.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Contractual risk detail */}
      {riscoContratual.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Detalhes do Risco Contratual</span>
          {riscoContratual.map((o: any) => (
            <div key={o.id} className="p-2 rounded border border-red-500/20 bg-red-500/5 text-sm">
              <span className="font-medium">{o.tipo_ocorrencia}:</span> {o.descricao}
              {o.responsavel && <span className="text-xs text-muted-foreground ml-1">— {o.responsavel}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
