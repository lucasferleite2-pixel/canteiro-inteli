

# ERP Obra Inteligente — Plano de Implementação

## Visão Geral
Sistema SaaS multi-tenant para gestão completa de obras, com tema escuro corporativo, sidebar de navegação e design mobile-first. Cada empresa (tenant) terá seus dados isolados.

---

## Fase 1 — Fundação e Estrutura

### Autenticação e Multi-tenancy
- Login/cadastro com email e senha
- Criação de "Empresa" (tenant) no primeiro acesso
- Convite de membros à empresa
- Perfis de acesso: Administrador, Engenheiro, Mestre de Obras, Financeiro, Jurídico, Cliente
- Controle de acesso por obra e por perfil

### Layout e Navegação
- Sidebar com navegação para todos os módulos
- Tema escuro elegante e corporativo
- Header com dados do usuário, empresa e notificações
- Layout responsivo mobile-first

---

## Fase 2 — Módulos de Gestão de Obras

### Cadastro de Obras
- Criar, editar e arquivar obras
- Status: Planejamento, Em Andamento, Pausada, Concluída
- Vincular equipe, contratos e orçamento a cada obra

### Diário de Obra Digital
- Registro diário com: atividades executadas, equipe presente, clima, materiais recebidos, ocorrências
- Upload de fotos com data/hora
- Comentários técnicos
- Histórico imutável (registros não podem ser editados/excluídos após 24h)
- Exportação em PDF auditável

### Dashboard Executivo
- Visão geral de todas as obras com status visual
- Financeiro resumido (orçado vs realizado)
- Alertas críticos em destaque
- Últimos registros do diário
- Obrigações contratuais próximas do vencimento

---

## Fase 3 — Módulos de Controle

### Gestão Contratual
- Upload e cadastro de contratos e editais
- Registro de obrigações e prazos contratuais
- Controle de aditivos e medições
- Registro de notificações e ocorrências contratuais
- Histórico versionado de documentos

### Financeiro por Obra
- Orçamento detalhado por obra
- Comparativo orçado vs realizado
- Centros de custo
- Contas a pagar e receber
- Fluxo de caixa da obra
- Upload de notas fiscais e comprovantes
- Dashboard financeiro visual com gráficos

### Pipeline de Licitação → Execução
- Cadastro de editais com checklist de documentação
- Controle de prazos de licitação
- Registro de propostas enviadas
- Conversão automática de licitação vencida em obra ativa
- Vinculação com contrato e financeiro
- Histórico completo desde a licitação

---

## Fase 4 — Inteligência e Alertas

### Alertas Estratégicos
- Alertas automáticos baseados em regras: atraso de obra, desvio financeiro, falta de registros diários, prazos contratuais próximos
- Central de notificações no sistema
- Indicadores visuais no dashboard

### IA como Copiloto (via Lovable AI)
- Resumo automático do diário de obra
- Análise de risco contratual a partir de documentos enviados
- Insights financeiros (desvios, tendências)
- Sugestões preventivas baseadas nos dados do sistema

---

## Aspectos Técnicos

### Backend (Lovable Cloud)
- Banco de dados com isolamento por empresa (tenant_id em todas as tabelas)
- RLS policies para segurança dos dados entre tenants
- Storage para fotos, documentos e contratos
- Edge functions para lógica de IA e geração de PDFs

### Segurança e Rastreabilidade
- Histórico de alterações em registros críticos (audit log)
- Registros do diário de obra imutáveis após período
- Versionamento de documentos contratuais
- Controle de acesso granular por perfil e por obra

