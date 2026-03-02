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

export const DEMO_OBRAS = [
  { id: "d1", name: "Residencial Parque Verde", description: "Condomínio residencial com 4 torres e 120 unidades.", address: "Av. das Palmeiras, 1200 — Belo Horizonte/MG", budget: 4_200_000, start_date: "2025-06-01", expected_end_date: "2027-03-01", status: "in_progress", created_at: "2025-06-01T10:00:00Z", updated_at: "2026-03-01T10:00:00Z" },
  { id: "d2", name: "Edifício Comercial Centro", description: "Edifício comercial de 12 andares no centro da cidade.", address: "Rua Rio Branco, 450 — Rio de Janeiro/RJ", budget: 3_500_000, start_date: "2025-09-15", expected_end_date: "2027-06-30", status: "in_progress", created_at: "2025-09-15T10:00:00Z", updated_at: "2026-03-02T08:00:00Z" },
  { id: "d3", name: "Ponte Rodoviária BR-040", description: "Construção de ponte sobre o rio Paraopeba na BR-040.", address: "BR-040, km 452 — Congonhas/MG", budget: 2_800_000, start_date: "2025-11-01", expected_end_date: "2027-01-15", status: "in_progress", created_at: "2025-11-01T10:00:00Z", updated_at: "2026-02-28T14:00:00Z" },
  { id: "d4", name: "Escola Municipal Ipê", description: "Construção de escola com 16 salas, quadra e refeitório.", address: "Rua dos Ipês, 88 — Contagem/MG", budget: 1_200_000, start_date: "2025-08-10", expected_end_date: "2026-12-20", status: "in_progress", created_at: "2025-08-10T10:00:00Z", updated_at: "2026-03-01T11:00:00Z" },
  { id: "d5", name: "Galpão Industrial Sul", description: "Galpão logístico de 5.000 m² com doca para caminhões.", address: "Rod. Fernão Dias, km 512 — Betim/MG", budget: 800_000, start_date: "2025-03-01", expected_end_date: "2026-01-15", status: "completed", created_at: "2025-03-01T10:00:00Z", updated_at: "2026-01-15T16:00:00Z" },
  { id: "d6", name: "Reforma Prefeitura", description: "Reforma e adequação do prédio da prefeitura municipal.", address: "Praça da Liberdade, 1 — Sabará/MG", budget: 300_000, start_date: null, expected_end_date: null, status: "planning", created_at: "2026-02-20T10:00:00Z", updated_at: "2026-02-20T10:00:00Z" },
];

export const DEMO_RDO_ENTRIES = [
  { id: "rdo1", obra_id: "d1", data: "2026-03-01", clima: "ensolarado", equipe_total: 32, horas_trabalhadas: 8, produtividade_percentual: 85, risco_dia: "baixo", fase_obra: "estrutura", custo_dia: 18500, percentual_fisico_dia: 1.2, percentual_fisico_acumulado: 62, observacoes_gerais: "Concretagem do 3º pavimento concluída sem intercorrências.", is_locked: true, company_id: "00000000-0000-0000-0000-000000000000", criado_por: "demo-user-id", created_at: "2026-03-01T17:00:00Z", updated_at: "2026-03-01T17:00:00Z", version: 1, hash_integridade: null },
  { id: "rdo2", obra_id: "d1", data: "2026-02-28", clima: "nublado", equipe_total: 28, horas_trabalhadas: 8, produtividade_percentual: 78, risco_dia: "baixo", fase_obra: "estrutura", custo_dia: 16200, percentual_fisico_dia: 1.0, percentual_fisico_acumulado: 60.8, observacoes_gerais: "Montagem de formas do 3º pavimento. Recebimento de aço CA-50.", is_locked: true, company_id: "00000000-0000-0000-0000-000000000000", criado_por: "demo-user-id", created_at: "2026-02-28T17:00:00Z", updated_at: "2026-02-28T17:00:00Z", version: 1, hash_integridade: null },
  { id: "rdo3", obra_id: "d1", data: "2026-02-27", clima: "chuvoso", equipe_total: 15, horas_trabalhadas: 4, produtividade_percentual: 42, risco_dia: "medio", fase_obra: "estrutura", custo_dia: 8900, percentual_fisico_dia: 0.4, percentual_fisico_acumulado: 59.8, observacoes_gerais: "Chuva forte pela manhã. Trabalho interrompido das 7h às 11h.", is_locked: false, company_id: "00000000-0000-0000-0000-000000000000", criado_por: "demo-user-id", created_at: "2026-02-27T17:00:00Z", updated_at: "2026-02-27T17:00:00Z", version: 1, hash_integridade: null },
  { id: "rdo4", obra_id: "d2", data: "2026-03-02", clima: "ensolarado", equipe_total: 24, horas_trabalhadas: 9, produtividade_percentual: 72, risco_dia: "medio", fase_obra: "fundacao", custo_dia: 22000, percentual_fisico_dia: 0.8, percentual_fisico_acumulado: 35, observacoes_gerais: "Escavação de estacas em andamento. Solo com presença de rocha.", is_locked: false, company_id: "00000000-0000-0000-0000-000000000000", criado_por: "demo-user-id", created_at: "2026-03-02T17:00:00Z", updated_at: "2026-03-02T17:00:00Z", version: 1, hash_integridade: null },
  { id: "rdo5", obra_id: "d3", data: "2026-02-28", clima: "nublado", equipe_total: 18, horas_trabalhadas: 8, produtividade_percentual: 55, risco_dia: "alto", fase_obra: "fundacao", custo_dia: 35000, percentual_fisico_dia: 0.5, percentual_fisico_acumulado: 28, observacoes_gerais: "Fundação com dificuldade devido ao nível do rio. Equipamento de bombeamento ativado.", is_locked: false, company_id: "00000000-0000-0000-0000-000000000000", criado_por: "demo-user-id", created_at: "2026-02-28T17:00:00Z", updated_at: "2026-02-28T17:00:00Z", version: 1, hash_integridade: null },
  { id: "rdo6", obra_id: "d4", data: "2026-03-01", clima: "ensolarado", equipe_total: 20, horas_trabalhadas: 8, produtividade_percentual: 91, risco_dia: "baixo", fase_obra: "alvenaria", custo_dia: 9500, percentual_fisico_dia: 1.5, percentual_fisico_acumulado: 55, observacoes_gerais: "Alvenaria das salas 9 a 12 concluída. Início da cobertura da quadra.", is_locked: true, company_id: "00000000-0000-0000-0000-000000000000", criado_por: "demo-user-id", created_at: "2026-03-01T17:00:00Z", updated_at: "2026-03-01T17:00:00Z", version: 1, hash_integridade: null },
];
