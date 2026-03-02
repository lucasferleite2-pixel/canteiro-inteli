import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { DEMO_FASE_PLANEJAMENTO, DEMO_DESPESAS } from "@/lib/demoData";
import { calculateProjectionModel } from "@/lib/projectionModel";
import {
  generateCorrectiveActions,
  computeStrategicRisk,
  STRATEGIC_RISK_CONFIG,
  TIPO_LABELS,
  type CorrectiveAction,
} from "@/lib/correctiveActionsEngine";
import {
  Brain,
  TrendingDown,
  RefreshCw,
  CalendarClock,
  FileText,
  Eye,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Shield,
} from "lucide-react";

interface Props {
  rdos: any[];
  despesas: any[];
  obraId: string;
  companyId: string;
  obraOrcamento?: number;
}

const URGENCY_COLORS: Record<string, string> = {
  baixo: "hsl(152, 60%, 40%)",
  medio: "hsl(38, 92%, 50%)",
  alto: "hsl(24, 95%, 53%)",
  critico: "hsl(0, 72%, 51%)",
};

const URGENCY_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  baixo: "secondary",
  medio: "outline",
  alto: "destructive",
  critico: "destructive",
};

const TIPO_ICONS: Record<string, typeof TrendingDown> = {
  reducao_custo: TrendingDown,
  troca_fornecedor: RefreshCw,
  ajuste_cronograma: CalendarClock,
  pedido_aditivo: FileText,
};

const currFmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function RdoCorrectiveActionsPanel({ rdos, despesas, obraId, companyId, obraOrcamento }: Props) {
  const { isDemo } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: planejamento = [] } = useQuery({
    queryKey: ["obra_fase_planejamento_ca", obraId],
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

  const { projection, actions, strategicRisk } = useMemo(() => {
    if (!rdos.length || !planejamento.length) {
      return { projection: null, actions: [], strategicRisk: "estavel" as const };
    }
    const proj = calculateProjectionModel(rdos, planejamento);
    const acts = generateCorrectiveActions(proj, rdos, despesas, obraOrcamento);
    const risk = computeStrategicRisk(acts, proj);
    return { projection: proj, actions: acts, strategicRisk: risk };
  }, [rdos, planejamento, despesas, obraOrcamento]);

  if (!actions.length) return null;

  const riskConfig = STRATEGIC_RISK_CONFIG[strategicRisk];

  return (
    <div className="space-y-4">
      {/* Header with strategic risk */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recomendações Estratégicas
          </h3>
          <Badge variant="outline" className="text-xs gap-1">
            {actions.length} ação(ões)
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" style={{ color: riskConfig.color }} />
          <span className="text-xs font-semibold" style={{ color: riskConfig.color }}>
            {riskConfig.emoji} {riskConfig.label}
          </span>
        </div>
      </div>

      {/* Alert for critical items */}
      {strategicRisk === "critico" && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <Shield className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Risco Estratégico Crítico</AlertTitle>
          <AlertDescription className="text-xs">
            Múltiplas ações corretivas urgentes identificadas. Recomenda-se reunião de avaliação imediata.
          </AlertDescription>
        </Alert>
      )}

      {/* Action cards */}
      <div className="space-y-3">
        {actions.map((action) => {
          const Icon = TIPO_ICONS[action.tipo_acao] || FileText;
          const isExpanded = expanded === action.id;

          return (
            <Card key={action.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Action header */}
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : action.id)}
                >
                  <div
                    className="p-2 rounded-lg shrink-0"
                    style={{ backgroundColor: `${URGENCY_COLORS[action.nivel_urgencia]}15` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: URGENCY_COLORS[action.nivel_urgencia] }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {TIPO_LABELS[action.tipo_acao]}
                      </span>
                      <Badge className="text-[10px]" variant="outline">
                        {action.fase}
                      </Badge>
                      <Badge
                        variant={URGENCY_BADGE[action.nivel_urgencia]}
                        className="text-[10px] px-1.5"
                        style={{ borderColor: URGENCY_COLORS[action.nivel_urgencia], color: URGENCY_COLORS[action.nivel_urgencia] }}
                      >
                        {action.nivel_urgencia.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground">{action.motivo}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Impacto estimado: <strong>{currFmt(action.impacto_estimado)}</strong>
                    </p>
                  </div>
                  <div className="shrink-0 pt-1">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded analysis */}
                {isExpanded && (
                  <div className="border-t bg-muted/10 p-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        Análise Técnica
                      </h4>
                      <div className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">
                        {action.analise_tecnica}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <Eye className="h-3 w-3" /> Ver análise completa
                      </Button>
                      <Button size="sm" variant="default" className="h-7 text-xs gap-1">
                        <Check className="h-3 w-3" /> Aceitar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive">
                        <X className="h-3 w-3" /> Rejeitar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
