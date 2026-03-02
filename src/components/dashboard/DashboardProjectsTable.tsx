import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building2 } from "lucide-react";

interface ProjectRow {
  id: string;
  name: string;
  status: string;
  budget: number | null;
  rdo_count: number;
  avg_productivity: number;
  last_rdo_date: string | null;
  risk_score: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  planning: { label: "Planejamento", variant: "outline" },
  in_progress: { label: "Em Andamento", variant: "default" },
  paused: { label: "Pausada", variant: "destructive" },
  completed: { label: "Concluída", variant: "secondary" },
};

const riskBadge: Record<string, { label: string; className: string }> = {
  alto: { label: "Alto", className: "bg-destructive/15 text-destructive border-destructive/30" },
  medio: { label: "Médio", className: "bg-warning/15 text-warning border-warning/30" },
  baixo: { label: "Baixo", className: "bg-success/15 text-success border-success/30" },
};

export function DashboardProjectsTable({ projects }: { projects: ProjectRow[] }) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(v);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Resumo por Obra
        </CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhuma obra cadastrada.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">Obra</th>
                  <th className="text-left py-2 px-2 font-medium">Status</th>
                  <th className="text-right py-2 px-2 font-medium">Orçamento</th>
                  <th className="text-center py-2 px-2 font-medium">RDOs</th>
                  <th className="text-center py-2 px-2 font-medium">Produtividade</th>
                  <th className="text-center py-2 px-2 font-medium">Risco</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const st = statusConfig[p.status] || statusConfig.planning;
                  const risk = riskBadge[p.risk_score] || riskBadge.baixo;
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 px-2 font-medium max-w-[180px] truncate">{p.name}</td>
                      <td className="py-2.5 px-2">
                        <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">{formatCurrency(p.budget || 0)}</td>
                      <td className="py-2.5 px-2 text-center tabular-nums">{p.rdo_count}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <Progress value={p.avg_productivity} className="h-2 flex-1" />
                          <span className="text-xs tabular-nums w-8 text-right">{p.avg_productivity}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <Badge variant="outline" className={`text-xs ${risk.className}`}>{risk.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
