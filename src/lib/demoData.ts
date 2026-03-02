// Mock data used exclusively in demo mode (?demo=true)

export const DEMO_KPI = {
  activeProjects: 4,
  totalProjects: 6,
  diaryToday: 3,
  unreadAlerts: 5,
  totalBudget: 12_800_000,
  totalRevenue: 4_350_000,
  totalExpense: 3_120_000,
  avgProductivity: 74,
};

export const DEMO_PROJECTS = [
  { id: "d1", name: "Residencial Parque Verde", status: "in_progress", budget: 4_200_000, rdo_count: 47, avg_productivity: 82, last_rdo_date: "2026-03-01", risk_score: "baixo" },
  { id: "d2", name: "Edifício Comercial Centro", status: "in_progress", budget: 3_500_000, rdo_count: 32, avg_productivity: 68, last_rdo_date: "2026-03-02", risk_score: "medio" },
  { id: "d3", name: "Ponte Rodoviária BR-040", status: "in_progress", budget: 2_800_000, rdo_count: 21, avg_productivity: 55, last_rdo_date: "2026-02-28", risk_score: "alto" },
  { id: "d4", name: "Escola Municipal Ipê", status: "in_progress", budget: 1_200_000, rdo_count: 15, avg_productivity: 91, last_rdo_date: "2026-03-01", risk_score: "baixo" },
  { id: "d5", name: "Galpão Industrial Sul", status: "completed", budget: 800_000, rdo_count: 60, avg_productivity: 78, last_rdo_date: "2026-01-15", risk_score: "baixo" },
  { id: "d6", name: "Reforma Prefeitura", status: "planning", budget: 300_000, rdo_count: 0, avg_productivity: 0, last_rdo_date: null, risk_score: "baixo" },
];

export const DEMO_ALERTS = [
  { id: "a1", title: "Risco alto consecutivo", message: "Ponte Rodoviária BR-040 com 5 dias seguidos de risco alto. Ação imediata recomendada.", severity: "critical", created_at: "2026-03-02T08:00:00Z", project_name: "Ponte Rodoviária BR-040" },
  { id: "a2", title: "Produtividade abaixo da meta", message: "Edifício Comercial Centro com produtividade média de 68% — abaixo da meta de 75%.", severity: "warning", created_at: "2026-03-01T14:30:00Z", project_name: "Edifício Comercial Centro" },
  { id: "a3", title: "Contrato próximo do vencimento", message: "Contrato CT-2024/087 vence em 15 dias. Providenciar renovação.", severity: "high", created_at: "2026-03-01T10:00:00Z", project_name: "Residencial Parque Verde" },
  { id: "a4", title: "Material sem previsão orçamentária", message: "3 itens de material lançados fora do orçamento previsto nesta semana.", severity: "warning", created_at: "2026-02-28T16:20:00Z", project_name: "Ponte Rodoviária BR-040" },
  { id: "a5", title: "RDO não preenchido", message: "Escola Municipal Ipê sem registro de diário de obra ontem.", severity: "info", created_at: "2026-02-28T09:00:00Z", project_name: "Escola Municipal Ipê" },
];

export const DEMO_FINANCIAL_CHART = [
  { name: "Res. Parque Verde", receita: 1_800_000, despesa: 1_200_000 },
  { name: "Ed. Comercial Centro", receita: 1_100_000, despesa: 950_000 },
  { name: "Ponte BR-040", receita: 900_000, despesa: 720_000 },
  { name: "Escola Ipê", receita: 400_000, despesa: 200_000 },
  { name: "Galpão Industrial", receita: 150_000, despesa: 50_000 },
];
