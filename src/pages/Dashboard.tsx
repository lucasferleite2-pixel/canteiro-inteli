import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ClipboardList, AlertTriangle, DollarSign, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { companyId } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const [projectsRes, diaryRes, alertsRes, financialRes] = await Promise.all([
        supabase.from("projects").select("id, status, budget", { count: "exact" }).eq("company_id", companyId),
        supabase.from("diary_entries").select("id", { count: "exact" }).eq("company_id", companyId).gte("entry_date", new Date().toISOString().split("T")[0]),
        supabase.from("alerts").select("id", { count: "exact" }).eq("company_id", companyId).is("read_at", null),
        supabase.from("financial_records").select("amount, type").eq("company_id", companyId),
      ]);

      const projects = projectsRes.data || [];
      const activeProjects = projects.filter((p) => p.status === "in_progress").length;
      const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
      const diaryToday = diaryRes.count || 0;
      const unreadAlerts = alertsRes.count || 0;

      return {
        activeProjects,
        totalProjects: projects.length,
        diaryToday,
        unreadAlerts,
        totalBudget,
      };
    },
    enabled: !!companyId,
  });

  const { data: recentProjects = [] } = useQuery({
    queryKey: ["recent-projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("projects")
        .select("id, name, status")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!companyId,
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(v);

  const statCards = [
    { label: "Obras Ativas", value: stats?.activeProjects ?? 0, icon: Building2, color: "text-primary" },
    { label: "Registros Hoje", value: stats?.diaryToday ?? 0, icon: ClipboardList, color: "text-success" },
    { label: "Alertas Pendentes", value: stats?.unreadAlerts ?? 0, icon: AlertTriangle, color: "text-warning" },
    { label: "Orçamento Total", value: stats ? formatCurrency(stats.totalBudget) : "R$ 0", icon: DollarSign, color: "text-info" },
  ];

  const statusLabel: Record<string, string> = {
    planning: "Planejamento",
    in_progress: "Em Andamento",
    paused: "Pausada",
    completed: "Concluída",
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Executivo</h1>
        <p className="text-muted-foreground">Visão geral de todas as obras e indicadores.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Obras Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma obra cadastrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {recentProjects.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{statusLabel[p.status] || p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Alertas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {stats?.unreadAlerts ? `${stats.unreadAlerts} alertas pendentes.` : "Nenhum alerta no momento."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
