import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ClipboardList, AlertTriangle, DollarSign, TrendingUp, HardHat } from "lucide-react";

interface KpiData {
  activeProjects: number;
  totalProjects: number;
  diaryToday: number;
  unreadAlerts: number;
  totalBudget: number;
  totalRevenue: number;
  totalExpense: number;
  avgProductivity: number;
}

export function DashboardKpiCards({ data }: { data: KpiData }) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(v);

  const balance = data.totalRevenue - data.totalExpense;

  const cards = [
    { label: "Obras Ativas", value: `${data.activeProjects}/${data.totalProjects}`, icon: Building2, color: "text-primary", bg: "bg-primary/10" },
    { label: "Alertas Pendentes", value: String(data.unreadAlerts), icon: AlertTriangle, color: data.unreadAlerts > 0 ? "text-destructive" : "text-success", bg: data.unreadAlerts > 0 ? "bg-destructive/10" : "bg-success/10" },
    { label: "Registros Hoje", value: String(data.diaryToday), icon: ClipboardList, color: "text-info", bg: "bg-info/10" },
    { label: "Orçamento Total", value: formatCurrency(data.totalBudget), icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
    { label: "Saldo Financeiro", value: formatCurrency(balance), icon: TrendingUp, color: balance >= 0 ? "text-success" : "text-destructive", bg: balance >= 0 ? "bg-success/10" : "bg-destructive/10" },
    { label: "Produtividade Média", value: `${data.avgProductivity}%`, icon: HardHat, color: data.avgProductivity >= 70 ? "text-success" : data.avgProductivity >= 50 ? "text-warning" : "text-destructive", bg: data.avgProductivity >= 70 ? "bg-success/10" : data.avgProductivity >= 50 ? "bg-warning/10" : "bg-destructive/10" },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label} className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
            <div className={`rounded-md p-1.5 ${c.bg}`}>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
