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

export const DEMO_ATIVIDADES = [
  // rdo1 – Residencial Parque Verde 01/03
  { id: "atv1", rdo_dia_id: "rdo1", company_id: "00000000-0000-0000-0000-000000000000", descricao: "Concretagem laje 3º pavimento — bloco A", tipo_atividade: "Execução", impacto_cronograma: "nenhum", concluida: true, created_at: "2026-03-01T08:00:00Z" },
  { id: "atv2", rdo_dia_id: "rdo1", company_id: "00000000-0000-0000-0000-000000000000", descricao: "Instalação elétrica — prumadas do 2º pavimento", tipo_atividade: "Execução", impacto_cronograma: "leve", concluida: true, created_at: "2026-03-01T09:00:00Z" },
  { id: "atv3", rdo_dia_id: "rdo1", company_id: "00000000-0000-0000-0000-000000000000", descricao: "Recebimento de aço CA-50 (12 ton)", tipo_atividade: "Logística", impacto_cronograma: "nenhum", concluida: true, created_at: "2026-03-01T10:00:00Z" },
  // rdo2 – Residencial Parque Verde 28/02
  { id: "atv4", rdo_dia_id: "rdo2", company_id: "00000000-0000-0000-0000-000000000000", descricao: "Montagem de formas 3º pavimento — bloco B", tipo_atividade: "Execução", impacto_cronograma: "nenhum", concluida: true, created_at: "2026-02-28T08:00:00Z" },
  { id: "atv5", rdo_dia_id: "rdo2", company_id: "00000000-0000-0000-0000-000000000000", descricao: "Conferência topográfica de níveis", tipo_atividade: "Fiscalização", impacto_cronograma: "nenhum", concluida: true, created_at: "2026-02-28T10:00:00Z" },
  // rdo3 – Residencial Parque Verde 27/02 (chuvoso)
  { id: "atv6", rdo_dia_id: "rdo3", company_id: "00000000-0000-0000-0000-000000000000", descricao: "Limpeza e drenagem da área de fundação", tipo_atividade: "Logística", impacto_cronograma: "médio", concluida: false, created_at: "2026-02-27T11:00:00Z" },
  // rdo4 – Ed. Comercial Centro 02/03
  { id: "atv7", rdo_dia_id: "rdo4", company_id: "00000000-0000-0000-0000-000000000000", descricao: "Escavação de estacas — eixo D", tipo_atividade: "Execução", impacto_cronograma: "leve", concluida: false, created_at: "2026-03-02T08:00:00Z" },
  { id: "atv8", rdo_dia_id: "rdo4", company_id: "00000000-0000-0000-0000-000000000000", descricao: "Sondagem complementar — presença de rocha", tipo_atividade: "Planejamento", impacto_cronograma: "crítico", concluida: true, created_at: "2026-03-02T10:00:00Z" },
  // rdo5 – Ponte BR-040 28/02
  { id: "atv9", rdo_dia_id: "rdo5", company_id: "00000000-0000-0000-0000-000000000000", descricao: "Bombeamento de água na cava de fundação", tipo_atividade: "Logística", impacto_cronograma: "crítico", concluida: true, created_at: "2026-02-28T07:00:00Z" },
  { id: "atv10", rdo_dia_id: "rdo5", company_id: "00000000-0000-0000-0000-000000000000", descricao: "Concretagem do bloco de ancoragem — eixo 1", tipo_atividade: "Execução", impacto_cronograma: "médio", concluida: false, created_at: "2026-02-28T09:00:00Z" },
  // rdo6 – Escola Ipê 01/03
  { id: "atv11", rdo_dia_id: "rdo6", company_id: "00000000-0000-0000-0000-000000000000", descricao: "Alvenaria salas 9 a 12 — conclusão", tipo_atividade: "Execução", impacto_cronograma: "nenhum", concluida: true, created_at: "2026-03-01T08:00:00Z" },
  { id: "atv12", rdo_dia_id: "rdo6", company_id: "00000000-0000-0000-0000-000000000000", descricao: "Início da estrutura metálica da cobertura da quadra", tipo_atividade: "Execução", impacto_cronograma: "nenhum", concluida: false, created_at: "2026-03-01T13:00:00Z" },
];

export const DEMO_MATERIAIS = [
  // rdo1
  { id: "mat1", rdo_dia_id: "rdo1", company_id: "00000000-0000-0000-0000-000000000000", tipo: "Consumo", item: "Concreto fck 30 MPa", quantidade: 45, unidade: "m³", valor_unitario: 320, valor_total: 14400, previsto_em_orcamento: true, gera_alerta_desequilibrio: false, created_at: "2026-03-01T08:00:00Z" },
  { id: "mat2", rdo_dia_id: "rdo1", company_id: "00000000-0000-0000-0000-000000000000", tipo: "Consumo", item: "Aço CA-50 Ø 12,5mm", quantidade: 2.5, unidade: "ton", valor_unitario: 4800, valor_total: 12000, previsto_em_orcamento: true, gera_alerta_desequilibrio: false, created_at: "2026-03-01T09:00:00Z" },
  // rdo2
  { id: "mat3", rdo_dia_id: "rdo2", company_id: "00000000-0000-0000-0000-000000000000", tipo: "Compra", item: "Madeira para formas (pinus)", quantidade: 120, unidade: "m²", valor_unitario: 45, valor_total: 5400, previsto_em_orcamento: true, gera_alerta_desequilibrio: false, created_at: "2026-02-28T08:00:00Z" },
  // rdo3
  { id: "mat4", rdo_dia_id: "rdo3", company_id: "00000000-0000-0000-0000-000000000000", tipo: "Aluguel", item: "Bomba submersível", quantidade: 1, unidade: "diária", valor_unitario: 850, valor_total: 850, previsto_em_orcamento: false, gera_alerta_desequilibrio: true, created_at: "2026-02-27T11:00:00Z" },
  // rdo4
  { id: "mat5", rdo_dia_id: "rdo4", company_id: "00000000-0000-0000-0000-000000000000", tipo: "Aluguel", item: "Perfuratriz rotativa", quantidade: 1, unidade: "diária", valor_unitario: 3200, valor_total: 3200, previsto_em_orcamento: true, gera_alerta_desequilibrio: false, created_at: "2026-03-02T08:00:00Z" },
  { id: "mat6", rdo_dia_id: "rdo4", company_id: "00000000-0000-0000-0000-000000000000", tipo: "Consumo", item: "Brocas de tungstênio", quantidade: 4, unidade: "un", valor_unitario: 1200, valor_total: 4800, previsto_em_orcamento: false, gera_alerta_desequilibrio: true, created_at: "2026-03-02T10:00:00Z" },
  // rdo5
  { id: "mat7", rdo_dia_id: "rdo5", company_id: "00000000-0000-0000-0000-000000000000", tipo: "Consumo", item: "Concreto fck 40 MPa", quantidade: 30, unidade: "m³", valor_unitario: 380, valor_total: 11400, previsto_em_orcamento: true, gera_alerta_desequilibrio: false, created_at: "2026-02-28T09:00:00Z" },
  // rdo6
  { id: "mat8", rdo_dia_id: "rdo6", company_id: "00000000-0000-0000-0000-000000000000", tipo: "Consumo", item: "Blocos cerâmicos 14x19x39", quantidade: 2000, unidade: "un", valor_unitario: 2.8, valor_total: 5600, previsto_em_orcamento: true, gera_alerta_desequilibrio: false, created_at: "2026-03-01T08:00:00Z" },
  { id: "mat9", rdo_dia_id: "rdo6", company_id: "00000000-0000-0000-0000-000000000000", tipo: "Consumo", item: "Argamassa industrializada", quantidade: 80, unidade: "saco", valor_unitario: 28, valor_total: 2240, previsto_em_orcamento: true, gera_alerta_desequilibrio: false, created_at: "2026-03-01T09:00:00Z" },
];

export const DEMO_OCORRENCIAS = [
  // rdo3 – dia chuvoso
  { id: "oc1", rdo_dia_id: "rdo3", company_id: "00000000-0000-0000-0000-000000000000", tipo_ocorrencia: "Clima", descricao: "Chuva forte das 7h às 11h — impossibilitou trabalho a céu aberto.", impacto: "alto", responsavel: null, gera_risco_contratual: true, gera_alerta: true, created_at: "2026-02-27T11:00:00Z" },
  { id: "oc2", rdo_dia_id: "rdo3", company_id: "00000000-0000-0000-0000-000000000000", tipo_ocorrencia: "Logística", descricao: "Acúmulo de água na escavação — necessário bombeamento.", impacto: "médio", responsavel: "Eng. Marcos", gera_risco_contratual: false, gera_alerta: false, created_at: "2026-02-27T12:00:00Z" },
  // rdo4
  { id: "oc3", rdo_dia_id: "rdo4", company_id: "00000000-0000-0000-0000-000000000000", tipo_ocorrencia: "Técnica", descricao: "Presença de matacão rochoso não previsto em sondagem. Necessário replanejamento de estacas.", impacto: "crítico", responsavel: "Eng. Paula", gera_risco_contratual: true, gera_alerta: true, created_at: "2026-03-02T10:00:00Z" },
  // rdo5
  { id: "oc4", rdo_dia_id: "rdo5", company_id: "00000000-0000-0000-0000-000000000000", tipo_ocorrencia: "Técnica", descricao: "Nível do rio acima do esperado — cota de fundação comprometida.", impacto: "alto", responsavel: "Eng. Carlos", gera_risco_contratual: true, gera_alerta: true, created_at: "2026-02-28T08:00:00Z" },
  { id: "oc5", rdo_dia_id: "rdo5", company_id: "00000000-0000-0000-0000-000000000000", tipo_ocorrencia: "Fornecedor", descricao: "Atraso na entrega de tirantes de ancoragem — previsão reprogramada para 05/03.", impacto: "médio", responsavel: "Compras", gera_risco_contratual: false, gera_alerta: false, created_at: "2026-02-28T14:00:00Z" },
];

export const DEMO_DESPESAS = [
  // rdo1 – Residencial Parque Verde 01/03
  { id: "desp1", rdo_dia_id: "rdo1", company_id: "00000000-0000-0000-0000-000000000000", tipo: "material", descricao: "Concreto usinado fck 30 MPa", quantidade: 45, unidade: "m³", valor_unitario: 320, valor_total: 14400, centro_custo: "Estrutura", previsto_no_orcamento: true, incluir_no_pdf: true, afeta_curva_financeira: true, observacao: null, created_at: "2026-03-01T08:00:00Z" },
  { id: "desp2", rdo_dia_id: "rdo1", company_id: "00000000-0000-0000-0000-000000000000", tipo: "mao_de_obra", descricao: "Equipe de concretagem (8h)", quantidade: 12, unidade: "HH", valor_unitario: 85, valor_total: 1020, centro_custo: "Estrutura", previsto_no_orcamento: true, incluir_no_pdf: true, afeta_curva_financeira: true, observacao: null, created_at: "2026-03-01T09:00:00Z" },
  { id: "desp3", rdo_dia_id: "rdo1", company_id: "00000000-0000-0000-0000-000000000000", tipo: "equipamento", descricao: "Bomba de concreto estacionária", quantidade: 1, unidade: "diária", valor_unitario: 2800, valor_total: 2800, centro_custo: "Estrutura", previsto_no_orcamento: true, incluir_no_pdf: true, afeta_curva_financeira: true, observacao: null, created_at: "2026-03-01T10:00:00Z" },
  // rdo2
  { id: "desp4", rdo_dia_id: "rdo2", company_id: "00000000-0000-0000-0000-000000000000", tipo: "material", descricao: "Madeira para formas (pinus)", quantidade: 120, unidade: "m²", valor_unitario: 45, valor_total: 5400, centro_custo: "Estrutura", previsto_no_orcamento: true, incluir_no_pdf: true, afeta_curva_financeira: true, observacao: null, created_at: "2026-02-28T08:00:00Z" },
  { id: "desp5", rdo_dia_id: "rdo2", company_id: "00000000-0000-0000-0000-000000000000", tipo: "mao_de_obra", descricao: "Carpinteiros — montagem de formas", quantidade: 8, unidade: "HH", valor_unitario: 75, valor_total: 600, centro_custo: "Estrutura", previsto_no_orcamento: true, incluir_no_pdf: true, afeta_curva_financeira: true, observacao: null, created_at: "2026-02-28T09:00:00Z" },
  // rdo4
  { id: "desp6", rdo_dia_id: "rdo4", company_id: "00000000-0000-0000-0000-000000000000", tipo: "equipamento", descricao: "Perfuratriz rotativa", quantidade: 1, unidade: "diária", valor_unitario: 3200, valor_total: 3200, centro_custo: "Fundação", previsto_no_orcamento: true, incluir_no_pdf: true, afeta_curva_financeira: true, observacao: null, created_at: "2026-03-02T08:00:00Z" },
  { id: "desp7", rdo_dia_id: "rdo4", company_id: "00000000-0000-0000-0000-000000000000", tipo: "material", descricao: "Brocas de tungstênio (extra)", quantidade: 4, unidade: "un", valor_unitario: 1200, valor_total: 4800, centro_custo: "Fundação", previsto_no_orcamento: false, incluir_no_pdf: true, afeta_curva_financeira: true, observacao: "Não previsto — solo rochoso", created_at: "2026-03-02T10:00:00Z" },
  { id: "desp8", rdo_dia_id: "rdo4", company_id: "00000000-0000-0000-0000-000000000000", tipo: "transporte", descricao: "Frete especial — equipamento pesado", quantidade: 1, unidade: "viagem", valor_unitario: 1500, valor_total: 1500, centro_custo: "Logística", previsto_no_orcamento: false, incluir_no_pdf: true, afeta_curva_financeira: true, observacao: null, created_at: "2026-03-02T11:00:00Z" },
  // rdo5
  { id: "desp9", rdo_dia_id: "rdo5", company_id: "00000000-0000-0000-0000-000000000000", tipo: "equipamento", descricao: "Bomba submersível de grande porte", quantidade: 2, unidade: "diária", valor_unitario: 1200, valor_total: 2400, centro_custo: "Fundação", previsto_no_orcamento: false, incluir_no_pdf: true, afeta_curva_financeira: true, observacao: "Emergência — nível do rio", created_at: "2026-02-28T07:00:00Z" },
  // rdo6
  { id: "desp10", rdo_dia_id: "rdo6", company_id: "00000000-0000-0000-0000-000000000000", tipo: "material", descricao: "Blocos cerâmicos 14x19x39", quantidade: 2000, unidade: "un", valor_unitario: 2.8, valor_total: 5600, centro_custo: "Alvenaria", previsto_no_orcamento: true, incluir_no_pdf: true, afeta_curva_financeira: true, observacao: null, created_at: "2026-03-01T08:00:00Z" },
  { id: "desp11", rdo_dia_id: "rdo6", company_id: "00000000-0000-0000-0000-000000000000", tipo: "mao_de_obra", descricao: "Pedreiros — alvenaria", quantidade: 16, unidade: "HH", valor_unitario: 65, valor_total: 1040, centro_custo: "Alvenaria", previsto_no_orcamento: true, incluir_no_pdf: true, afeta_curva_financeira: true, observacao: null, created_at: "2026-03-01T09:00:00Z" },
];

export const DEMO_FINANCIAL_RECORDS = [
  // Residencial Parque Verde (d1)
  { id: "fin1", description: "1ª Medição — Fundações", amount: 420000, type: "income", category: "Medição", due_date: "2026-01-15", paid_at: "2026-01-18", project_id: "d1", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-01-10T10:00:00Z" },
  { id: "fin2", description: "Concreto fck 30 MPa — Jan", amount: 185000, type: "expense", category: "Material", due_date: "2026-01-20", paid_at: "2026-01-20", project_id: "d1", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-01-12T08:00:00Z" },
  { id: "fin3", description: "Mão de obra — Jan", amount: 96000, type: "expense", category: "Mão de Obra", due_date: "2026-02-05", paid_at: "2026-02-05", project_id: "d1", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-01-31T18:00:00Z" },
  { id: "fin4", description: "2ª Medição — Estrutura", amount: 630000, type: "income", category: "Medição", due_date: "2026-02-15", paid_at: "2026-02-17", project_id: "d1", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-02-10T09:00:00Z" },
  { id: "fin5", description: "Aço CA-50 — Fev", amount: 210000, type: "expense", category: "Material", due_date: "2026-02-18", paid_at: "2026-02-18", project_id: "d1", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-02-12T14:00:00Z" },
  { id: "fin6", description: "Mão de obra — Fev", amount: 102000, type: "expense", category: "Mão de Obra", due_date: "2026-03-05", paid_at: null, project_id: "d1", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-02-28T18:00:00Z" },
  { id: "fin7", description: "Aluguel de grua — Fev/Mar", amount: 45000, type: "expense", category: "Equipamento", due_date: "2026-03-10", paid_at: null, project_id: "d1", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-02-25T10:00:00Z" },

  // Edifício Comercial Centro (d2)
  { id: "fin8", description: "1ª Medição — Terraplanagem", amount: 350000, type: "income", category: "Medição", due_date: "2026-01-20", paid_at: "2026-01-22", project_id: "d2", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-01-15T10:00:00Z" },
  { id: "fin9", description: "Escavação e contenção", amount: 278000, type: "expense", category: "Serviço", due_date: "2026-01-25", paid_at: "2026-01-25", project_id: "d2", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-01-18T09:00:00Z" },
  { id: "fin10", description: "Mão de obra — Jan", amount: 82000, type: "expense", category: "Mão de Obra", due_date: "2026-02-05", paid_at: "2026-02-05", project_id: "d2", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-01-31T18:00:00Z" },
  { id: "fin11", description: "Sondagem complementar (extra)", amount: 35000, type: "expense", category: "Serviço", due_date: "2026-03-08", paid_at: null, project_id: "d2", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-03-02T11:00:00Z" },

  // Ponte Rodoviária BR-040 (d3)
  { id: "fin12", description: "Adiantamento contratual", amount: 560000, type: "income", category: "Adiantamento", due_date: "2025-12-15", paid_at: "2025-12-15", project_id: "d3", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2025-12-10T08:00:00Z" },
  { id: "fin13", description: "Concreto fck 40 MPa — Jan", amount: 195000, type: "expense", category: "Material", due_date: "2026-01-20", paid_at: "2026-01-20", project_id: "d3", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-01-15T10:00:00Z" },
  { id: "fin14", description: "Bombeamento emergencial", amount: 12000, type: "expense", category: "Equipamento", due_date: "2026-02-28", paid_at: "2026-03-01", project_id: "d3", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-02-28T14:00:00Z" },
  { id: "fin15", description: "1ª Medição — Fundações", amount: 480000, type: "income", category: "Medição", due_date: "2026-02-20", paid_at: "2026-02-25", project_id: "d3", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-02-15T09:00:00Z" },
  { id: "fin16", description: "Tirantes de ancoragem", amount: 88000, type: "expense", category: "Material", due_date: "2026-03-15", paid_at: null, project_id: "d3", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-03-01T10:00:00Z" },

  // Escola Municipal Ipê (d4)
  { id: "fin17", description: "1ª Medição — Alvenaria", amount: 180000, type: "income", category: "Medição", due_date: "2026-02-10", paid_at: "2026-02-12", project_id: "d4", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-02-05T10:00:00Z" },
  { id: "fin18", description: "Blocos cerâmicos", amount: 42000, type: "expense", category: "Material", due_date: "2026-02-08", paid_at: "2026-02-08", project_id: "d4", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-02-03T08:00:00Z" },
  { id: "fin19", description: "Estrutura metálica cobertura quadra", amount: 95000, type: "expense", category: "Material", due_date: "2026-03-12", paid_at: null, project_id: "d4", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-03-01T14:00:00Z" },

  // Galpão Industrial Sul (d5 — concluída)
  { id: "fin20", description: "Medição final", amount: 240000, type: "income", category: "Medição", due_date: "2026-01-15", paid_at: "2026-01-18", project_id: "d5", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-01-10T10:00:00Z" },
  { id: "fin21", description: "Acabamento e pintura", amount: 68000, type: "expense", category: "Serviço", due_date: "2026-01-10", paid_at: "2026-01-10", project_id: "d5", company_id: "00000000-0000-0000-0000-000000000000", created_at: "2026-01-05T09:00:00Z" },
];
