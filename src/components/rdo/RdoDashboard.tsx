import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RdoPerformanceTab } from "./tabs/RdoPerformanceTab";
import { RdoProjectionPanel } from "./RdoProjectionPanel";
import { RdoCorrectiveActionsPanel } from "./RdoCorrectiveActionsPanel";
import { RdoCsvImport } from "./RdoCsvImport";
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Users,
  Activity,
  Calendar,
  BarChart3,
  TrendingDown,
  ShieldAlert,
  CheckCheck,
  RotateCcw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface RdoDashboardProps {
  rdos: any[];
  despesas?: any[];
  obraId?: string;
  companyId?: string;
  obraOrcamento?: number;
}

export function RdoDashboard({ rdos, despesas = [], obraId, companyId, obraOrcamento }: RdoDashboardProps) {
  const stats = useMemo(() => {
    if (!rdos.length) return null;

    const sorted = [...rdos].sort((a, b) => a.data.localeCompare(b.data));

    const totalCost = sorted.reduce((s, r) => s + (Number(r.custo_dia) || 0), 0);
    const avgProductivity = sorted.reduce((s, r) => s + (Number(r.produtividade_percentual) || 0), 0) / sorted.length;
    const totalTeam = sorted.reduce((s, r) => s + (Number(r.equipe_total) || 0), 0);
    const avgTeam = totalTeam / sorted.length;
    const totalHours = sorted.reduce((s, r) => s + (Number(r.horas_trabalhadas) || 0), 0);
    const highRiskDays = sorted.filter((r) => r.risco_dia === "alto").length;
    const lastProgress = Number(sorted[sorted.length - 1]?.percentual_fisico_acumulado) || 0;

    // Chart data
    const productivityData = sorted.map((r) => ({
      date: r.data.slice(5), // MM-DD
      value: Number(r.produtividade_percentual) || 0,
    }));

    let cumCost = 0;
    const costData = sorted.map((r) => {
      cumCost += Number(r.custo_dia) || 0;
      return { date: r.data.slice(5), value: cumCost };
    });

    const riskData = sorted.map((r) => ({
      date: r.data.slice(5),
      value: r.risco_dia === "alto" ? 3 : r.risco_dia === "medio" ? 2 : 1,
      level: r.risco_dia,
    }));

    // Alerts detection
    const alerts: { type: "productivity" | "risk"; title: string; description: string }[] = [];

    // Low productivity days (below 50%)
    const lowProdDays = sorted.filter((r) => (Number(r.produtividade_percentual) || 0) < 50);
    if (lowProdDays.length > 0) {
      const dates = lowProdDays.map((r) => r.data.slice(5)).join(", ");
      alerts.push({
        type: "productivity",
        title: `Produtividade abaixo de 50% em ${lowProdDays.length} dia(s)`,
        description: `Dias afetados: ${dates}. Verifique causas como falta de material, condições climáticas ou equipe insuficiente.`,
      });
    }

    // 3+ consecutive high-risk days
    let maxConsec = 0;
    let curConsec = 0;
    let consecStart = "";
    let consecEnd = "";
    let bestStart = "";
    let bestEnd = "";
    for (const r of sorted) {
      if (r.risco_dia === "alto") {
        if (curConsec === 0) consecStart = r.data.slice(5);
        curConsec++;
        consecEnd = r.data.slice(5);
        if (curConsec > maxConsec) {
          maxConsec = curConsec;
          bestStart = consecStart;
          bestEnd = consecEnd;
        }
      } else {
        curConsec = 0;
      }
    }
    if (maxConsec >= 3) {
      alerts.push({
        type: "risk",
        title: `${maxConsec} dias consecutivos com risco alto`,
        description: `Período: ${bestStart} a ${bestEnd}. Sequência prolongada de risco alto pode indicar problemas estruturais na operação. Ação corretiva recomendada.`,
      });
    }

    return {
      totalCost,
      avgProductivity,
      avgTeam,
      totalHours,
      highRiskDays,
      lastProgress,
      totalDays: sorted.length,
      productivityData,
      costData,
      riskData,
      alerts,
    };
  }, [rdos]);

  // Dismissed alerts persistence via localStorage
  const STORAGE_KEY = "rdo-dismissed-alerts";
  const getDismissed = (): string[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  };
  const [dismissed, setDismissed] = useState<string[]>(getDismissed);

  const dismissAlert = useCallback((key: string) => {
    setDismissed((prev) => {
      const next = [...prev, key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    if (!stats) return;
    const keys = stats.alerts.map((a) => a.title);
    setDismissed((prev) => {
      const next = [...new Set([...prev, ...keys])];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [stats]);

  const restoreAlerts = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setDismissed([]);
  }, []);

  if (!stats) return null;

  const visibleAlerts = stats.alerts.filter((a) => !dismissed.includes(a.title));

  const riskColor = (level: string) => {
    if (level === "alto") return "hsl(0, 72%, 51%)";
    if (level === "medio") return "hsl(38, 92%, 50%)";
    return "hsl(152, 60%, 40%)";
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Dashboard de KPIs
        </h2>
        <Badge variant="secondary" className="text-xs">{stats.totalDays} dias</Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Produtividade Média"
          value={`${stats.avgProductivity.toFixed(0)}%`}
          color="text-primary"
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Custo Acumulado"
          value={formatCurrency(stats.totalCost)}
          color="text-primary"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Dias Risco Alto"
          value={String(stats.highRiskDays)}
          color={stats.highRiskDays > 0 ? "text-destructive" : "text-muted-foreground"}
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Avanço Físico"
          value={`${stats.lastProgress.toFixed(1)}%`}
          color="text-primary"
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Equipe Média"
          value={stats.avgTeam.toFixed(0)}
          color="text-muted-foreground"
        />
        <KpiCard
          icon={<Calendar className="h-4 w-4" />}
          label="Horas Totais"
          value={stats.totalHours.toFixed(0)}
          color="text-muted-foreground"
        />
      </div>

      {/* Smart Alerts */}
      {(visibleAlerts.length > 0 || dismissed.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {visibleAlerts.length > 0
                ? `${visibleAlerts.length} alerta(s) ativo(s)`
                : "Nenhum alerta ativo"}
              {dismissed.length > 0 && ` · ${dismissed.length} lido(s)`}
            </span>
            <div className="flex items-center gap-1">
              {dismissed.length > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={restoreAlerts}>
                  <RotateCcw className="h-3 w-3" /> Restaurar lidos
                </Button>
              )}
              {visibleAlerts.length > 1 && (
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={dismissAll}>
                  <CheckCheck className="h-3 w-3" /> Marcar todos como lidos
                </Button>
              )}
            </div>
          </div>
          {visibleAlerts.map((alert, i) => (
            <Alert key={i} variant="destructive" className="border-destructive/30 bg-destructive/5 relative">
              {alert.type === "productivity" ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <ShieldAlert className="h-4 w-4" />
              )}
              <AlertTitle className="text-sm font-semibold pr-20">{alert.title}</AlertTitle>
              <AlertDescription className="text-xs pr-20">{alert.description}</AlertDescription>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => dismissAlert(alert.title)}
              >
                <CheckCheck className="h-3.5 w-3.5" /> Lido
              </Button>
            </Alert>
          ))}
        </div>
      )}

      {/* Mini Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Productivity */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Produtividade Diária (%)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={stats.productivityData}>
                <defs>
                  <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210, 100%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(210, 100%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number) => [`${v.toFixed(0)}%`, "Produtividade"]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(210, 100%, 45%)"
                  strokeWidth={2}
                  fill="url(#prodGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cumulative Cost */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Custo Acumulado (R$)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={stats.costData}>
                <defs>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(152, 60%, 40%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(152, 60%, 40%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number) => [formatCurrency(v), "Custo"]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(152, 60%, 40%)"
                  strokeWidth={2}
                  fill="url(#costGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Risk */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Nível de Risco Diário
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={stats.riskData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, 3]} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(_: any, __: any, props: any) => {
                    const labels: Record<string, string> = { baixo: "Baixo", medio: "Médio", alto: "Alto" };
                    return [labels[props.payload.level] || props.payload.level, "Risco"];
                  }}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {stats.riskData.map((entry, index) => (
                    <Cell key={index} fill={riskColor(entry.level)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Corrective Actions */}
      {obraId && companyId && (
        <RdoCorrectiveActionsPanel obraId={obraId} companyId={companyId} rdos={rdos} despesas={despesas} obraOrcamento={obraOrcamento} />
      )}

      {/* Predictive Analysis */}
      {obraId && companyId && (
        <RdoProjectionPanel obraId={obraId} companyId={companyId} rdos={rdos} />
      )}

      {/* Performance by Phase */}
      {obraId && companyId && (
        <RdoPerformanceTab obraId={obraId} companyId={companyId} rdos={rdos} />
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 flex flex-col gap-1">
        <div className={`flex items-center gap-1.5 ${color}`}>
          {icon}
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
            {label}
          </span>
        </div>
        <span className={`text-lg font-bold ${color}`}>{value}</span>
      </CardContent>
    </Card>
  );
}
