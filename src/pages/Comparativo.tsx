import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Users,
  Activity,
  Calendar,
  Building2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Legend,
  Cell,
} from "recharts";

interface ProjectStats {
  id: string;
  name: string;
  status: string;
  totalDays: number;
  avgProductivity: number;
  totalCost: number;
  avgCostPerDay: number;
  highRiskDays: number;
  riskPercent: number;
  lastProgress: number;
  avgTeam: number;
  totalHours: number;
}

const COLORS = [
  "hsl(210, 100%, 45%)",
  "hsl(152, 60%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 60%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(180, 60%, 40%)",
];

export default function Comparativo() {
  const { companyId } = useAuth();

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: allRdos = [], isLoading } = useQuery({
    queryKey: ["rdo_dia_all", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("rdo_dia")
        .select("*")
        .eq("company_id", companyId)
        .order("data", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const stats: ProjectStats[] = useMemo(() => {
    if (!projects.length || !allRdos.length) return [];

    return projects
      .map((p) => {
        const rdos = allRdos.filter((r: any) => r.obra_id === p.id);
        if (rdos.length === 0) return null;

        const totalCost = rdos.reduce((s: number, r: any) => s + (Number(r.custo_dia) || 0), 0);
        const avgProd = rdos.reduce((s: number, r: any) => s + (Number(r.produtividade_percentual) || 0), 0) / rdos.length;
        const totalTeam = rdos.reduce((s: number, r: any) => s + (Number(r.equipe_total) || 0), 0);
        const totalHours = rdos.reduce((s: number, r: any) => s + (Number(r.horas_trabalhadas) || 0), 0);
        const highRisk = rdos.filter((r: any) => r.risco_dia === "alto").length;
        const lastProg = Number(rdos[rdos.length - 1]?.percentual_fisico_acumulado) || 0;

        return {
          id: p.id,
          name: p.name,
          status: p.status,
          totalDays: rdos.length,
          avgProductivity: avgProd,
          totalCost,
          avgCostPerDay: rdos.length > 0 ? totalCost / rdos.length : 0,
          highRiskDays: highRisk,
          riskPercent: rdos.length > 0 ? (highRisk / rdos.length) * 100 : 0,
          lastProgress: lastProg,
          avgTeam: rdos.length > 0 ? totalTeam / rdos.length : 0,
          totalHours,
        } as ProjectStats;
      })
      .filter(Boolean) as ProjectStats[];
  }, [projects, allRdos]);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  // Chart data
  const barData = useMemo(
    () =>
      stats.map((s) => ({
        name: s.name.length > 15 ? s.name.slice(0, 15) + "…" : s.name,
        Produtividade: Number(s.avgProductivity.toFixed(1)),
        "Avanço Físico": Number(s.lastProgress.toFixed(1)),
        "% Risco Alto": Number(s.riskPercent.toFixed(1)),
      })),
    [stats]
  );

  const costBarData = useMemo(
    () =>
      stats.map((s) => ({
        name: s.name.length > 15 ? s.name.slice(0, 15) + "…" : s.name,
        "Custo Total": s.totalCost,
        "Custo/Dia": Number(s.avgCostPerDay.toFixed(0)),
      })),
    [stats]
  );

  const radarData = useMemo(() => {
    if (stats.length === 0) return [];
    const maxCost = Math.max(...stats.map((s) => s.totalCost), 1);
    const maxTeam = Math.max(...stats.map((s) => s.avgTeam), 1);
    const maxHours = Math.max(...stats.map((s) => s.totalHours), 1);

    const metrics = [
      { metric: "Produtividade" },
      { metric: "Avanço Físico" },
      { metric: "Equipe" },
      { metric: "Horas" },
      { metric: "Eficiência Custo" },
    ];

    return metrics.map((m) => {
      const row: any = { metric: m.metric };
      stats.forEach((s) => {
        let val = 0;
        switch (m.metric) {
          case "Produtividade": val = s.avgProductivity; break;
          case "Avanço Físico": val = s.lastProgress; break;
          case "Equipe": val = (s.avgTeam / maxTeam) * 100; break;
          case "Horas": val = (s.totalHours / maxHours) * 100; break;
          case "Eficiência Custo": val = maxCost > 0 ? 100 - (s.totalCost / maxCost) * 100 : 50; break;
        }
        row[s.name] = Number(val.toFixed(1));
      });
      return row;
    });
  }, [stats]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comparativo de Obras</h1>
          <p className="text-sm text-muted-foreground">
            Análise gerencial lado a lado dos KPIs de todas as obras com RDO
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-pulse text-muted-foreground">Carregando dados...</div>
        </div>
      ) : stats.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Sem dados para comparar</p>
            <p className="text-sm text-muted-foreground/70">
              Crie registros RDO em pelo menos uma obra para visualizar o comparativo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Indicadores por Obra</CardTitle>
              <CardDescription>{stats.length} obra(s) com registros RDO</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Obra</th>
                      <th className="text-center px-3 py-3 font-medium text-muted-foreground">Dias</th>
                      <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                        <div className="flex items-center justify-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Produt.</div>
                      </th>
                      <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                        <div className="flex items-center justify-center gap-1"><Activity className="h-3.5 w-3.5" /> Avanço</div>
                      </th>
                      <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                        <div className="flex items-center justify-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Custo Total</div>
                      </th>
                      <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                        <div className="flex items-center justify-center gap-1"><DollarSign className="h-3.5 w-3.5" /> R$/Dia</div>
                      </th>
                      <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                        <div className="flex items-center justify-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Risco Alto</div>
                      </th>
                      <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                        <div className="flex items-center justify-center gap-1"><Users className="h-3.5 w-3.5" /> Equipe</div>
                      </th>
                      <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                        <div className="flex items-center justify-center gap-1"><Calendar className="h-3.5 w-3.5" /> Horas</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s, i) => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="truncate max-w-[200px]">{s.name}</span>
                            <Badge variant="outline" className="text-[10px] h-5">{s.status}</Badge>
                          </div>
                        </td>
                        <td className="text-center px-3 py-3">{s.totalDays}</td>
                        <td className="text-center px-3 py-3 font-semibold">{s.avgProductivity.toFixed(0)}%</td>
                        <td className="text-center px-3 py-3">{s.lastProgress.toFixed(1)}%</td>
                        <td className="text-center px-3 py-3">{formatCurrency(s.totalCost)}</td>
                        <td className="text-center px-3 py-3">{formatCurrency(s.avgCostPerDay)}</td>
                        <td className="text-center px-3 py-3">
                          <Badge variant={s.highRiskDays > 0 ? "destructive" : "secondary"} className="text-xs">
                            {s.highRiskDays} ({s.riskPercent.toFixed(0)}%)
                          </Badge>
                        </td>
                        <td className="text-center px-3 py-3">{s.avgTeam.toFixed(0)}</td>
                        <td className="text-center px-3 py-3">{s.totalHours.toFixed(0)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Performance Comparison */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Desempenho Comparativo (%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} barCategoryGap="20%">
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Produtividade" fill="hsl(210, 100%, 45%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Avanço Físico" fill="hsl(152, 60%, 40%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="% Risco Alto" fill="hsl(0, 72%, 51%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cost Comparison */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Comparativo de Custos (R$)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={costBarData} barCategoryGap="20%">
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number) => [formatCurrency(v)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Custo Total" fill="hsl(38, 92%, 50%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Custo/Dia" fill="hsl(280, 60%, 50%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Radar Chart */}
            {stats.length >= 2 && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Perfil Multidimensional das Obras
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                      <PolarGrid stroke="hsl(220, 15%, 30%)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }} />
                      {stats.map((s, i) => (
                        <Radar
                          key={s.id}
                          name={s.name}
                          dataKey={s.name}
                          stroke={COLORS[i % COLORS.length]}
                          fill={COLORS[i % COLORS.length]}
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                      ))}
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
