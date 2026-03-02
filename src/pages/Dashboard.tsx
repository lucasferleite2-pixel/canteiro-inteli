import { Loader2 } from "lucide-react";
import { DemoBanner } from "@/components/DemoBanner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DashboardKpiCards } from "@/components/dashboard/DashboardKpiCards";
import { DashboardProjectsTable } from "@/components/dashboard/DashboardProjectsTable";
import { DashboardAlerts } from "@/components/dashboard/DashboardAlerts";
import { DashboardFinancialChart } from "@/components/dashboard/DashboardFinancialChart";
import { DEMO_KPI, DEMO_PROJECTS, DEMO_ALERTS, DEMO_FINANCIAL_CHART } from "@/lib/demoData";

export default function Dashboard() {
  const { companyId, isDemo } = useAuth();

  // ── KPI data ──
  const { data: kpi, isLoading } = useQuery({
    queryKey: ["exec-dashboard-kpi", companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const [projectsRes, diaryRes, alertsRes, financialRes, rdoRes] = await Promise.all([
        supabase.from("projects").select("id, status, budget").eq("company_id", companyId),
        supabase.from("diary_entries").select("id", { count: "exact" }).eq("company_id", companyId).gte("entry_date", new Date().toISOString().split("T")[0]),
        supabase.from("alerts").select("id", { count: "exact" }).eq("company_id", companyId).is("read_at", null),
        supabase.from("financial_records").select("amount, type").eq("company_id", companyId),
        supabase.from("rdo_dia").select("produtividade_percentual").eq("company_id", companyId),
      ]);

      const projects = projectsRes.data || [];
      const financials = financialRes.data || [];
      const rdos = rdoRes.data || [];

      const totalRevenue = financials.filter((f) => f.type === "receita").reduce((s, f) => s + Number(f.amount), 0);
      const totalExpense = financials.filter((f) => f.type === "despesa").reduce((s, f) => s + Number(f.amount), 0);
      const avgProd = rdos.length > 0 ? Math.round(rdos.reduce((s, r) => s + Number(r.produtividade_percentual || 0), 0) / rdos.length) : 0;

      return {
        activeProjects: projects.filter((p) => p.status === "in_progress").length,
        totalProjects: projects.length,
        diaryToday: diaryRes.count || 0,
        unreadAlerts: alertsRes.count || 0,
        totalBudget: projects.reduce((s, p) => s + (p.budget || 0), 0),
        totalRevenue,
        totalExpense,
        avgProductivity: avgProd,
      };
    },
    enabled: !!companyId && !isDemo,
  });

  // ── Projects with RDO aggregates ──
  const { data: projectRows = [] } = useQuery({
    queryKey: ["exec-dashboard-projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data: projects } = await supabase
        .from("projects").select("id, name, status, budget")
        .eq("company_id", companyId).order("updated_at", { ascending: false });
      if (!projects?.length) return [];

      const { data: rdos } = await supabase
        .from("rdo_dia").select("obra_id, produtividade_percentual, risco_dia, data")
        .eq("company_id", companyId);

      const rdoMap = new Map<string, typeof rdos>();
      (rdos || []).forEach((r) => {
        if (!rdoMap.has(r.obra_id)) rdoMap.set(r.obra_id, []);
        rdoMap.get(r.obra_id)!.push(r);
      });

      return projects.map((p) => {
        const pRdos = rdoMap.get(p.id) || [];
        const avgProd = pRdos.length > 0 ? Math.round(pRdos.reduce((s, r) => s + Number(r.produtividade_percentual || 0), 0) / pRdos.length) : 0;
        const highRisk = pRdos.filter((r) => r.risco_dia === "alto").length;
        const riskScore = highRisk >= 3 ? "alto" : highRisk >= 1 ? "medio" : "baixo";
        const sorted = [...pRdos].sort((a, b) => b.data.localeCompare(a.data));
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          budget: p.budget,
          rdo_count: pRdos.length,
          avg_productivity: avgProd,
          last_rdo_date: sorted[0]?.data || null,
          risk_score: riskScore,
        };
      });
    },
    enabled: !!companyId && !isDemo,
  });

  // ── Alerts ──
  const { data: alerts = [] } = useQuery({
    queryKey: ["exec-dashboard-alerts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("alerts").select("id, title, message, severity, created_at, project_id")
        .eq("company_id", companyId).is("read_at", null)
        .order("created_at", { ascending: false }).limit(10);

      if (!data?.length) return [];

      const projectIds = [...new Set(data.filter((a) => a.project_id).map((a) => a.project_id!))];
      const projectNames = new Map<string, string>();
      if (projectIds.length > 0) {
        const { data: projs } = await supabase.from("projects").select("id, name").in("id", projectIds);
        (projs || []).forEach((p) => projectNames.set(p.id, p.name));
      }

      return data.map((a) => ({
        ...a,
        project_name: a.project_id ? projectNames.get(a.project_id) : undefined,
      }));
    },
    enabled: !!companyId && !isDemo,
  });

  // ── Financial by project ──
  const { data: financialChart = [] } = useQuery({
    queryKey: ["exec-dashboard-financial", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const [{ data: records }, { data: projects }] = await Promise.all([
        supabase.from("financial_records").select("amount, type, project_id").eq("company_id", companyId),
        supabase.from("projects").select("id, name").eq("company_id", companyId),
      ]);
      if (!records?.length || !projects?.length) return [];

      const nameMap = new Map(projects.map((p) => [p.id, p.name]));
      const agg = new Map<string, { receita: number; despesa: number }>();
      records.forEach((r) => {
        if (!r.project_id) return;
        if (!agg.has(r.project_id)) agg.set(r.project_id, { receita: 0, despesa: 0 });
        const entry = agg.get(r.project_id)!;
        if (r.type === "receita") entry.receita += Number(r.amount);
        else entry.despesa += Number(r.amount);
      });

      return Array.from(agg.entries())
        .map(([id, vals]) => ({ name: (nameMap.get(id) || "Outros").substring(0, 20), ...vals }))
        .sort((a, b) => (b.receita + b.despesa) - (a.receita + a.despesa))
        .slice(0, 8);
    },
    enabled: !!companyId && !isDemo,
  });

  // Use demo data when in demo mode
  const resolvedKpi = isDemo ? DEMO_KPI : kpi;
  const resolvedProjects = isDemo ? DEMO_PROJECTS : projectRows;
  const resolvedAlerts = isDemo ? DEMO_ALERTS : alerts;
  const resolvedFinancial = isDemo ? DEMO_FINANCIAL_CHART : financialChart;

  if (!isDemo && isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DemoBanner />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Executivo</h1>
        <p className="text-muted-foreground text-sm">Visão consolidada de obras, finanças e alertas.</p>
      </div>

      {resolvedKpi && <DashboardKpiCards data={resolvedKpi} />}

      <DashboardProjectsTable projects={resolvedProjects} />

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardFinancialChart data={resolvedFinancial} />
        <DashboardAlerts alerts={resolvedAlerts} />
      </div>
    </div>
  );
}
