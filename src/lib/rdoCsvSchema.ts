// Schema completo do RDO para importação/exportação CSV
// Cada linha do CSV = 1 RDO (rdo_dia) + sub-itens aninhados (atividades, materiais, despesas, ocorrências)
// Sub-itens usam formato pipe-separado: "campo1:valor1;campo2:valor2|campo1:valor1;campo2:valor2"

export const RDO_CSV_COLUMNS = [
  // Identificação
  { key: "data", label: "data", type: "date", required: true, example: "2025-03-15", help: "Data do RDO no formato AAAA-MM-DD ou DD/MM/AAAA" },
  { key: "numero_sequencial", label: "numero_sequencial", type: "number", required: false, example: "", help: "Vazio = sistema gera automaticamente por obra" },

  // Condições gerais
  { key: "clima", label: "clima", type: "enum[Ensolarado|Nublado|Chuvoso|Parcialmente Nublado|Tempestade]", required: true, example: "Ensolarado", help: "Clima predominante do dia" },
  { key: "fase_obra", label: "fase_obra", type: "text", required: false, example: "Fundação", help: "Ex: Sondagem, Fundação, Estrutura, Alvenaria, Cobertura, Instalações, Acabamento, Urbanização" },
  { key: "risco_dia", label: "risco_dia", type: "enum[baixo|medio|alto]", required: false, example: "baixo", help: "Nível de risco do dia" },

  // Equipe e tempo
  { key: "equipe_total", label: "equipe_total", type: "number", required: true, example: "12", help: "Número total de pessoas no canteiro" },
  { key: "horas_trabalhadas", label: "horas_trabalhadas", type: "number", required: false, example: "8", help: "Horas trabalhadas no dia" },

  // Avanço físico
  { key: "percentual_fisico_dia", label: "percentual_fisico_dia", type: "number", required: false, example: "2.5", help: "% executado no dia (0-100)" },
  { key: "percentual_fisico_acumulado", label: "percentual_fisico_acumulado", type: "number", required: false, example: "35.5", help: "% acumulado da obra (0-100)" },
  { key: "quantidade_executada", label: "quantidade_executada", type: "number", required: false, example: "120", help: "Quantidade executada no dia" },
  { key: "unidade_medicao", label: "unidade_medicao", type: "text", required: false, example: "m²", help: "Unidade de medição (m², m³, ml, un)" },
  { key: "produtividade_percentual", label: "produtividade_percentual", type: "number", required: false, example: "85", help: "Produtividade do dia (0-100)" },

  // Custo
  { key: "custo_dia", label: "custo_dia", type: "number", required: false, example: "0", help: "Custo total do dia (calculado automaticamente das despesas se vazio)" },

  // Observações
  { key: "observacoes_gerais", label: "observacoes_gerais", type: "text", required: false, example: "Dia produtivo. Concretagem da sapata SP-12 concluída.", help: "Observações livres sobre o dia" },

  // === SUB-ITENS ANINHADOS (separados por |) ===
  // Atividades: descricao;hora;tipo_atividade;fase;concluida;impacto_cronograma
  { key: "atividades", label: "atividades", type: "nested", required: false, example: "Concretagem sapata SP-12;08:00;Execução;Fundação;true;nenhum|Armação pilar P-04;14:00;Execução;Estrutura;false;atraso", help: "Cada atividade separada por |. Campos: descricao;hora;tipo_atividade;fase;concluida;impacto_cronograma" },

  // Materiais: item;tipo;quantidade;unidade;valor_unitario;centro_custo;fase_relacionada
  { key: "materiais", label: "materiais", type: "nested", required: false, example: "Cimento CP-II;Consumo;50;sc;38.50;Material;Fundação|Areia média;Recebimento;10;m³;120;Material;Fundação", help: "Cada material separado por |. Campos: item;tipo;quantidade;unidade;valor_unitario;centro_custo;fase_relacionada" },

  // Despesas: descricao;tipo;quantidade;unidade;valor_unitario;centro_custo;fase;previsto_no_orcamento;afeta_curva_financeira
  { key: "despesas", label: "despesas", type: "nested", required: false, example: "Diesel para gerador;combustivel;50;L;6.20;Operacional;Fundação;true;true|Refeição equipe;alimentacao;12;un;25;RH;;true;true", help: "Cada despesa separada por |. Campos: descricao;tipo;quantidade;unidade;valor_unitario;centro_custo;fase;previsto_no_orcamento;afeta_curva_financeira" },

  // Ocorrências: descricao;tipo_ocorrencia;impacto;responsavel;gera_alerta;gera_risco_contratual
  { key: "ocorrencias", label: "ocorrencias", type: "nested", required: false, example: "Chuva forte às 15h interrompeu concretagem;Climática;medio;Mestre João;true;false", help: "Cada ocorrência separada por |. Campos: descricao;tipo_ocorrencia;impacto;responsavel;gera_alerta;gera_risco_contratual" },
] as const;

export type RdoCsvRow = Record<string, string>;

export interface ParsedRdoRow {
  rowNumber: number;
  raw: RdoCsvRow;
  errors: string[];
  warnings: string[];
  data: {
    rdo: {
      data: string;
      numero_sequencial?: number | null;
      clima: string;
      fase_obra?: string | null;
      risco_dia?: string | null;
      equipe_total: number;
      horas_trabalhadas?: number | null;
      percentual_fisico_dia?: number | null;
      percentual_fisico_acumulado?: number | null;
      quantidade_executada?: number | null;
      unidade_medicao?: string | null;
      produtividade_percentual?: number | null;
      custo_dia?: number | null;
      observacoes_gerais?: string | null;
    };
    atividades: Array<{
      descricao: string;
      hora?: string | null;
      tipo_atividade: string;
      fase?: string | null;
      concluida?: boolean;
      impacto_cronograma?: string;
    }>;
    materiais: Array<{
      item: string;
      tipo: string;
      quantidade: number;
      unidade?: string | null;
      valor_unitario?: number | null;
      valor_total?: number | null;
      centro_custo?: string | null;
      fase_relacionada?: string | null;
    }>;
    despesas: Array<{
      descricao: string;
      tipo: string;
      quantidade: number;
      unidade?: string | null;
      valor_unitario: number;
      valor_total?: number | null;
      centro_custo?: string | null;
      fase?: string | null;
      previsto_no_orcamento?: boolean;
      afeta_curva_financeira?: boolean;
    }>;
    ocorrencias: Array<{
      descricao: string;
      tipo_ocorrencia: string;
      impacto?: string;
      responsavel?: string | null;
      gera_alerta?: boolean;
      gera_risco_contratual?: boolean;
    }>;
  };
}

const CLIMA_OPTIONS = ["Ensolarado", "Nublado", "Chuvoso", "Parcialmente Nublado", "Tempestade"];
const RISCO_OPTIONS = ["baixo", "medio", "alto"];

function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseNumber(raw: string): number | null {
  if (raw === "" || raw == null) return null;
  // Aceita "1.234,56" e "1234.56"
  const cleaned = String(raw).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

function parseBool(raw: string): boolean {
  const s = String(raw || "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "sim" || s === "yes";
}

function parseNestedField(raw: string, fieldNames: string[]): Array<Record<string, string>> {
  if (!raw || !raw.trim()) return [];
  return raw.split("|").map((chunk) => {
    const parts = chunk.split(";");
    const obj: Record<string, string> = {};
    fieldNames.forEach((name, i) => {
      obj[name] = (parts[i] || "").trim();
    });
    return obj;
  });
}

export function validateAndParseRow(row: RdoCsvRow, rowNumber: number): ParsedRdoRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Data
  const data = normalizeDate(row.data || "");
  if (!data) errors.push("data inválida ou ausente (use AAAA-MM-DD ou DD/MM/AAAA)");

  // Clima
  const clima = (row.clima || "").trim();
  if (!clima) errors.push("clima é obrigatório");
  else if (!CLIMA_OPTIONS.includes(clima)) warnings.push(`clima "${clima}" fora das opções padrão`);

  // Equipe
  const equipe = parseNumber(row.equipe_total || "");
  if (equipe == null || equipe < 0) errors.push("equipe_total deve ser um número >= 0");

  // Risco
  const risco = (row.risco_dia || "").trim().toLowerCase();
  if (risco && !RISCO_OPTIONS.includes(risco)) warnings.push(`risco_dia "${risco}" inválido (use baixo/medio/alto)`);

  // Atividades
  const atividadesRaw = parseNestedField(row.atividades || "", [
    "descricao", "hora", "tipo_atividade", "fase", "concluida", "impacto_cronograma",
  ]);
  const atividades = atividadesRaw
    .filter((a) => a.descricao)
    .map((a) => ({
      descricao: a.descricao,
      hora: a.hora || null,
      tipo_atividade: a.tipo_atividade || "Execução",
      fase: a.fase || null,
      concluida: parseBool(a.concluida),
      impacto_cronograma: a.impacto_cronograma || "nenhum",
    }));

  // Materiais
  const materiaisRaw = parseNestedField(row.materiais || "", [
    "item", "tipo", "quantidade", "unidade", "valor_unitario", "centro_custo", "fase_relacionada",
  ]);
  const materiais = materiaisRaw
    .filter((m) => m.item)
    .map((m) => {
      const qtd = parseNumber(m.quantidade) ?? 0;
      const vu = parseNumber(m.valor_unitario) ?? 0;
      return {
        item: m.item,
        tipo: m.tipo || "Consumo",
        quantidade: qtd,
        unidade: m.unidade || "un",
        valor_unitario: vu,
        valor_total: qtd * vu,
        centro_custo: m.centro_custo || null,
        fase_relacionada: m.fase_relacionada || null,
      };
    });

  // Despesas
  const despesasRaw = parseNestedField(row.despesas || "", [
    "descricao", "tipo", "quantidade", "unidade", "valor_unitario",
    "centro_custo", "fase", "previsto_no_orcamento", "afeta_curva_financeira",
  ]);
  const despesas = despesasRaw
    .filter((d) => d.descricao)
    .map((d) => {
      const qtd = parseNumber(d.quantidade) ?? 1;
      const vu = parseNumber(d.valor_unitario) ?? 0;
      return {
        descricao: d.descricao,
        tipo: d.tipo || "material",
        quantidade: qtd,
        unidade: d.unidade || "un",
        valor_unitario: vu,
        valor_total: qtd * vu,
        centro_custo: d.centro_custo || null,
        fase: d.fase || null,
        previsto_no_orcamento: d.previsto_no_orcamento ? parseBool(d.previsto_no_orcamento) : true,
        afeta_curva_financeira: d.afeta_curva_financeira ? parseBool(d.afeta_curva_financeira) : true,
      };
    });

  // Ocorrências
  const ocorrenciasRaw = parseNestedField(row.ocorrencias || "", [
    "descricao", "tipo_ocorrencia", "impacto", "responsavel", "gera_alerta", "gera_risco_contratual",
  ]);
  const ocorrencias = ocorrenciasRaw
    .filter((o) => o.descricao)
    .map((o) => ({
      descricao: o.descricao,
      tipo_ocorrencia: o.tipo_ocorrencia || "Técnica",
      impacto: o.impacto || "baixo",
      responsavel: o.responsavel || null,
      gera_alerta: parseBool(o.gera_alerta),
      gera_risco_contratual: parseBool(o.gera_risco_contratual),
    }));

  return {
    rowNumber,
    raw: row,
    errors,
    warnings,
    data: {
      rdo: {
        data: data || "",
        numero_sequencial: parseNumber(row.numero_sequencial || "") ?? null,
        clima: clima || "Ensolarado",
        fase_obra: (row.fase_obra || "").trim() || null,
        risco_dia: risco || "baixo",
        equipe_total: equipe ?? 0,
        horas_trabalhadas: parseNumber(row.horas_trabalhadas || ""),
        percentual_fisico_dia: parseNumber(row.percentual_fisico_dia || ""),
        percentual_fisico_acumulado: parseNumber(row.percentual_fisico_acumulado || ""),
        quantidade_executada: parseNumber(row.quantidade_executada || ""),
        unidade_medicao: (row.unidade_medicao || "").trim() || null,
        produtividade_percentual: parseNumber(row.produtividade_percentual || ""),
        custo_dia: parseNumber(row.custo_dia || ""),
        observacoes_gerais: (row.observacoes_gerais || "").trim() || null,
      },
      atividades,
      materiais,
      despesas,
      ocorrencias,
    },
  };
}

export function generateCsvTemplate(): string {
  const headers = RDO_CSV_COLUMNS.map((c) => c.label).join(",");
  const types = RDO_CSV_COLUMNS.map((c) => `"${c.type}${c.required ? " *obrigatório*" : ""}"`).join(",");
  const examples = RDO_CSV_COLUMNS.map((c) => {
    const ex = c.example.replace(/"/g, '""');
    return `"${ex}"`;
  }).join(",");
  const empty = RDO_CSV_COLUMNS.map(() => "").join(",");

  return [
    headers,
    types,
    examples,
    empty,
    empty,
    empty,
  ].join("\n");
}
