import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import QRCode from "qrcode";

// ── Design Constants ──
const BLUE_TECH: [number, number, number] = [15, 47, 87];
const GRAY_LIGHT: [number, number, number] = [232, 237, 244];
const GRAY_TEXT: [number, number, number] = [107, 114, 128];
const DARK_TEXT: [number, number, number] = [30, 30, 30];
const RED_ALERT: [number, number, number] = [180, 30, 30];
const WARN_BG: [number, number, number] = [255, 245, 245];

const ML = 20;
const MR = 20;
const MB = 25;
const HEADER_H = 22;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function fmtDate(d: string) {
  try { return format(new Date(d + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }); } catch { return d; }
}

async function computeHash(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateQR(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 140, margin: 1 });
}

// ── ABNT Normative References Database ──
const ABNT_NORMS: Record<string, { code: string; title: string; description: string }[]> = {
  structural: [
    { code: "NBR 6118:2023", title: "Projeto de estruturas de concreto", description: "Estabelece os requisitos básicos exigíveis para projeto de estruturas de concreto simples, armado e protendido." },
    { code: "NBR 8681:2003", title: "Ações e segurança nas estruturas", description: "Fixa os requisitos exigíveis para a verificação da segurança das estruturas." },
    { code: "NBR 14931:2004", title: "Execução de estruturas de concreto", description: "Requisitos gerais para execução de estruturas de concreto." },
  ],
  waterproofing: [
    { code: "NBR 9574:2008", title: "Execução de impermeabilização", description: "Estabelece as exigências e recomendações relativas à execução de impermeabilização." },
    { code: "NBR 9575:2010", title: "Impermeabilização — Seleção e projeto", description: "Estabelece os requisitos de desempenho para sistemas de impermeabilização." },
  ],
  electrical: [
    { code: "NBR 5410:2004", title: "Instalações elétricas de baixa tensão", description: "Estabelece as condições a que devem satisfazer as instalações elétricas de baixa tensão." },
    { code: "NR 10", title: "Segurança em Instalações e Serviços em Eletricidade", description: "Estabelece os requisitos e condições mínimas para segurança em eletricidade." },
  ],
  fire_safety: [
    { code: "NBR 9077:2001", title: "Saídas de emergência em edifícios", description: "Estabelece as condições exigíveis de proteção contra incêndio em edifícios." },
    { code: "NBR 13714:2000", title: "Sistemas de hidrantes e de mangotinhos", description: "Requisitos para sistemas de hidrantes e mangotinhos para combate a incêndio." },
  ],
  materials: [
    { code: "NBR 7211:2009", title: "Agregados para concreto", description: "Especificação de agregados para uso em concreto." },
    { code: "NBR 7480:2007", title: "Aço destinado a armaduras para estruturas de concreto armado", description: "Especificação de barras e fios de aço para armaduras de concreto." },
    { code: "NBR 12655:2022", title: "Concreto de cimento Portland — Preparo, controle, recebimento e aceitação", description: "Requisitos para preparo e controle do concreto." },
  ],
  safety: [
    { code: "NR 18", title: "Segurança e Saúde no Trabalho na Indústria da Construção", description: "Estabelece diretrizes de ordem administrativa, de planejamento e de organização." },
    { code: "NR 35", title: "Trabalho em Altura", description: "Estabelece os requisitos mínimos e as medidas de proteção para o trabalho em altura." },
    { code: "NR 6", title: "Equipamentos de Proteção Individual — EPI", description: "Uso obrigatório de EPIs adequados à atividade." },
  ],
  geotechnical: [
    { code: "NBR 6122:2022", title: "Projeto e execução de fundações", description: "Estabelece os requisitos de projeto e execução de fundações de construções." },
    { code: "NBR 11682:2009", title: "Estabilidade de encostas", description: "Requisitos para estabilidade de taludes e encostas." },
  ],
  performance: [
    { code: "NBR 15575:2021", title: "Desempenho de edificações habitacionais", description: "Requisitos gerais de desempenho para edificações habitacionais — estrutura, vedações, coberturas, pisos." },
  ],
  environmental: [
    { code: "NBR ISO 14001:2015", title: "Sistemas de gestão ambiental", description: "Requisitos para um sistema de gestão ambiental que uma organização pode usar para aprimorar seu desempenho ambiental." },
    { code: "CONAMA 307/2002", title: "Gestão dos resíduos da construção civil", description: "Diretrizes, critérios e procedimentos para a gestão dos resíduos da construção civil." },
  ],
};

export type NcSeverity = "leve" | "moderada" | "grave" | "critica";
export type NcCategory = "structural" | "waterproofing" | "electrical" | "fire_safety" | "materials" | "safety" | "geotechnical" | "performance" | "environmental";

export interface NcItem {
  id: string;
  title: string;
  description: string;
  location: string;
  severity: NcSeverity;
  category: NcCategory;
  correctiveAction: string;
  deadline: string;
  responsible: string;
  rdoDiaId?: string;
  rdoDate?: string;
  photos?: string[]; // base64 images
}

export interface NcPdfOptions {
  projectName: string;
  municipality?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  technicalResponsible?: string;
  creaCau?: string;
  userName?: string;
  logoBase64?: string | null;
  brandColor?: string;
  items: NcItem[];
  additionalNorms?: string;
  conclusions?: string;
}

const SEVERITY_LABELS: Record<NcSeverity, string> = {
  leve: "LEVE",
  moderada: "MODERADA",
  grave: "GRAVE",
  critica: "CRÍTICA",
};

const SEVERITY_COLORS: Record<NcSeverity, [number, number, number]> = {
  leve: [34, 197, 94],
  moderada: [234, 179, 8],
  grave: [239, 130, 68],
  critica: [220, 38, 38],
};

const CATEGORY_LABELS: Record<NcCategory, string> = {
  structural: "Estrutural",
  waterproofing: "Impermeabilização",
  electrical: "Elétrica",
  fire_safety: "Segurança contra Incêndio",
  materials: "Materiais",
  safety: "Segurança do Trabalho",
  geotechnical: "Geotécnica",
  performance: "Desempenho",
  environmental: "Meio Ambiente",
};

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - MB) {
    doc.addPage();
    return HEADER_H + 4;
  }
  return y;
}

function addSectionTitle(doc: jsPDF, title: string, y: number, BC: [number, number, number]): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setDrawColor(BC[0], BC[1], BC[2]);
  doc.setLineWidth(0.6);
  doc.line(ML, y - 2, pageW - MR, y - 2);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BC[0], BC[1], BC[2]);
  doc.text(title, ML, y + 4);
  doc.setLineWidth(0.3);
  doc.line(ML, y + 7, pageW - MR, y + 7);
  return y + 12;
}

function addBodyText(doc: jsPDF, text: string, y: number, maxW?: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  const w = maxW || (pageW - ML - MR);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  const lines = doc.splitTextToSize(text, w);
  doc.text(lines, ML, y);
  return y + lines.length * 4.2 + 2;
}

function addWatermark(doc: jsPDF, text: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
  doc.setFontSize(50);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 30, 30);
  doc.text(text.toUpperCase(), pageW / 2, pageH / 2, { align: "center", angle: 45 });
  doc.restoreGraphicsState();
}

function addInstitutionalHeader(
  doc: jsPDF, projectName: string, companyName?: string,
  technicalResponsible?: string, logoBase64?: string | null,
  BC: [number, number, number] = BLUE_TECH
) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(BC[0], BC[1], BC[2]);
  doc.rect(0, 0, pageW, 2.5, "F");
  let hx = ML;
  if (logoBase64) {
    try { doc.addImage(logoBase64, "PNG", hx, 4, 12, 6); hx += 14; } catch {}
  }
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(RED_ALERT[0], RED_ALERT[1], RED_ALERT[2]);
  doc.text("LAUDO DE NÃO CONFORMIDADE", hx, 8);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text(`Obra: ${projectName}`, hx, 12);
  const rightX = pageW - MR;
  if (technicalResponsible) {
    doc.setFontSize(6);
    doc.text(`Resp. Técnico: ${technicalResponsible}`, rightX, 8, { align: "right" });
  }
  if (companyName) {
    doc.text(companyName, rightX, 12, { align: "right" });
  }
  doc.setDrawColor(RED_ALERT[0], RED_ALERT[1], RED_ALERT[2]);
  doc.setLineWidth(0.3);
  doc.line(ML, 15, pageW - MR, 15);
}

function addFooter(
  doc: jsPDF, pageNum: number, totalPages: number,
  reportId: string, companyName?: string, generatedAt?: string
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const fy = pageH - MB + 8;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(ML, fy, pageW - MR, fy);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(140, 140, 140);
  doc.text("Laudo de Não Conformidade — Documento gerado automaticamente pelo ERP", ML, fy + 4);
  if (generatedAt) doc.text(`Data de geração: ${generatedAt}`, ML, fy + 8);
  doc.text(`Página ${pageNum} de ${totalPages}`, pageW - MR, fy + 4, { align: "right" });
  if (companyName) doc.text(companyName, pageW - MR, fy + 8, { align: "right" });
}

// ══════════════════════════════════════════
// MAIN GENERATOR
// ══════════════════════════════════════════
export async function generateNaoConformidadePDF(
  options: NcPdfOptions,
  onProgress?: (step: string) => void
): Promise<void> {
  const {
    projectName, municipality, companyName, companyAddress, companyPhone,
    technicalResponsible, creaCau, userName, logoBase64, brandColor,
    items, additionalNorms, conclusions,
  } = options;

  const BC: [number, number, number] = brandColor ? hexToRgb(brandColor) : BLUE_TECH;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const now = new Date();
  const generatedAt = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const reportId = `LNC-${format(now, "yyyyMMddHHmmss")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - ML - MR;

  onProgress?.("Calculando hash de integridade...");
  const integrityHash = await computeHash(JSON.stringify({ reportId, projectName, generated: now.toISOString(), items: items.length }));
  const shortHash = integrityHash.substring(0, 16).toUpperCase();
  onProgress?.("Gerando QR Code...");
  const qrDataUrl = await generateQR(JSON.stringify({ id: reportId, hash: shortHash, project: projectName, nc_items: items.length, generated: now.toISOString() }));

  const bookmarks: { title: string; page: number }[] = [];
  function trackSection(title: string) {
    bookmarks.push({ title, page: doc.getNumberOfPages() });
  }

  // Severity summary
  const severityCounts: Record<NcSeverity, number> = { leve: 0, moderada: 0, grave: 0, critica: 0 };
  items.forEach((item) => { severityCounts[item.severity]++; });

  // ══════════════════════════════════════════
  // CAPA
  // ══════════════════════════════════════════
  onProgress?.("Gerando capa...");

  // Red top band
  doc.setFillColor(RED_ALERT[0], RED_ALERT[1], RED_ALERT[2]);
  doc.rect(0, 0, pageW, 50, "F");

  if (logoBase64) {
    try { doc.addImage(logoBase64, "PNG", (pageW - 40) / 2, 8, 40, 20); } catch {}
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text("LAUDO TÉCNICO", pageW / 2, 38, { align: "center" });
  doc.setFontSize(7);
  doc.text(companyName || "", pageW / 2, 44, { align: "center" });

  // Main title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(RED_ALERT[0], RED_ALERT[1], RED_ALERT[2]);
  doc.text("LAUDO DE", pageW / 2, 72, { align: "center" });
  doc.text("NÃO CONFORMIDADE", pageW / 2, 82, { align: "center" });

  doc.setDrawColor(RED_ALERT[0], RED_ALERT[1], RED_ALERT[2]);
  doc.setLineWidth(1);
  doc.line(60, 90, pageW - 60, 90);

  // Info box
  const infoStartY = 100;
  doc.setFillColor(WARN_BG[0], WARN_BG[1], WARN_BG[2]);
  doc.roundedRect(30, infoStartY, pageW - 60, 86, 2, 2, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);

  const coverInfo: [string, string][] = [
    ["Obra:", projectName],
    ["Município / UF:", municipality || "—"],
    ["Empresa:", companyName || "—"],
    ["Endereço:", companyAddress || "—"],
    ["Responsável Técnico:", technicalResponsible || "—"],
    ["CREA / CAU:", creaCau || "—"],
    ["Nº Não Conformidades:", String(items.length)],
    ["Data do Laudo:", generatedAt],
    ["Nº do Documento:", reportId],
  ];

  coverInfo.forEach(([label, value], i) => {
    const ly = infoStartY + 10 + i * 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label, 38, ly);
    doc.setFont("helvetica", "normal");
    doc.text(value, 95, ly);
  });

  // Severity badge summary on cover
  const badgeY = infoStartY + 82;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.text("Resumo por Gravidade:", 38, badgeY);

  let bx = 95;
  (["critica", "grave", "moderada", "leve"] as NcSeverity[]).forEach((sev) => {
    const count = severityCounts[sev];
    if (count > 0) {
      const col = SEVERITY_COLORS[sev];
      doc.setFillColor(col[0], col[1], col[2]);
      doc.roundedRect(bx, badgeY - 4, 28, 7, 1, 1, "F");
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(`${SEVERITY_LABELS[sev]}: ${count}`, bx + 14, badgeY, { align: "center" });
      bx += 31;
    }
  });

  // QR
  doc.addImage(qrDataUrl, "PNG", pageW - 70, infoStartY + 38, 28, 28);
  doc.setFontSize(6);
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text("Autenticidade", pageW - 56, infoStartY + 70, { align: "center" });

  // Bottom band
  doc.setFillColor(RED_ALERT[0], RED_ALERT[1], RED_ALERT[2]);
  doc.rect(0, pageH - 20, pageW, 20, "F");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(`Hash de Integridade (SHA-256): ${shortHash}`, pageW / 2, pageH - 12, { align: "center" });
  doc.text("Documento gerado automaticamente pelo ERP Canteiro Inteli", pageW / 2, pageH - 6, { align: "center" });

  // ══════════════════════════════════════════
  // SUMÁRIO (placeholder)
  // ══════════════════════════════════════════
  doc.addPage();
  trackSection("SUMÁRIO");
  const tocPageNum = doc.getNumberOfPages();

  // ══════════════════════════════════════════
  // SEÇÃO 1: IDENTIFICAÇÃO
  // ══════════════════════════════════════════
  onProgress?.("Gerando identificação...");
  doc.addPage();
  trackSection("1. IDENTIFICAÇÃO DO LAUDO");
  let y = addSectionTitle(doc, "1. IDENTIFICAÇÃO DO LAUDO", HEADER_H + 4, BC);

  autoTable(doc, {
    startY: y,
    head: [["Item", "Informação"]],
    body: [
      ["Obra", projectName],
      ["Empresa", companyName || "—"],
      ["Endereço", companyAddress || "—"],
      ["Telefone", companyPhone || "—"],
      ["Responsável Técnico", technicalResponsible || "—"],
      ["CREA / CAU", creaCau || "—"],
      ["Nº do Documento", reportId],
      ["Data de Emissão", generatedAt],
      ["Emitido por", userName || "Sistema"],
    ],
    theme: "grid",
    headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
    margin: { left: ML, right: MR, top: HEADER_H + 4 },
  });

  // ══════════════════════════════════════════
  // SEÇÃO 2: OBJETIVO
  // ══════════════════════════════════════════
  doc.addPage();
  trackSection("2. OBJETIVO DO LAUDO");
  y = addSectionTitle(doc, "2. OBJETIVO DO LAUDO", HEADER_H + 4, BC);
  y = addBodyText(doc,
    "O presente Laudo de Não Conformidade tem por objetivo registrar, documentar e fundamentar tecnicamente " +
    "as não conformidades identificadas durante o acompanhamento da obra, com base nas normas técnicas " +
    "da Associação Brasileira de Normas Técnicas (ABNT), Normas Regulamentadoras (NR) do Ministério do " +
    "Trabalho e Emprego, e demais legislações aplicáveis à construção civil.",
    y
  );
  y += 4;
  y = addBodyText(doc,
    "Este documento serve como instrumento técnico para fins de fiscalização, auditoria, " +
    "acompanhamento de ações corretivas e, quando necessário, como evidência em processos " +
    "administrativos, arbitrais ou judiciais.",
    y
  );

  // ══════════════════════════════════════════
  // SEÇÃO 3: FUNDAMENTAÇÃO NORMATIVA
  // ══════════════════════════════════════════
  onProgress?.("Gerando fundamentação normativa...");
  doc.addPage();
  trackSection("3. FUNDAMENTAÇÃO NORMATIVA (ABNT)");
  y = addSectionTitle(doc, "3. FUNDAMENTAÇÃO NORMATIVA (ABNT)", HEADER_H + 4, BC);

  y = addBodyText(doc,
    "As não conformidades descritas neste laudo foram avaliadas com base nas seguintes normas técnicas " +
    "e regulamentações, conforme a categoria de cada item identificado:",
    y
  );
  y += 4;

  // Collect unique categories from items
  const usedCategories = [...new Set(items.map((i) => i.category))];

  for (const cat of usedCategories) {
    const norms = ABNT_NORMS[cat] || [];
    if (norms.length === 0) continue;

    y = ensureSpace(doc, y, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BC[0], BC[1], BC[2]);
    doc.text(`▸ ${CATEGORY_LABELS[cat]}`, ML, y);
    y += 6;

    for (const norm of norms) {
      y = ensureSpace(doc, y, 16);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
      doc.text(`${norm.code} — ${norm.title}`, ML + 4, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
      const descLines = doc.splitTextToSize(norm.description, contentW - 10);
      doc.text(descLines, ML + 4, y);
      y += descLines.length * 3.5 + 4;
    }
  }

  // Additional norms if provided
  if (additionalNorms) {
    y = ensureSpace(doc, y, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BC[0], BC[1], BC[2]);
    doc.text("▸ Normas Complementares", ML, y);
    y += 6;
    y = addBodyText(doc, additionalNorms, y);
  }

  // ══════════════════════════════════════════
  // SEÇÃO 4: NÃO CONFORMIDADES IDENTIFICADAS
  // ══════════════════════════════════════════
  onProgress?.("Gerando não conformidades...");
  doc.addPage();
  trackSection("4. NÃO CONFORMIDADES IDENTIFICADAS");
  y = addSectionTitle(doc, "4. NÃO CONFORMIDADES IDENTIFICADAS", HEADER_H + 4, BC);

  // Summary table
  autoTable(doc, {
    startY: y,
    head: [["#", "Título", "Categoria", "Gravidade", "Prazo"]],
    body: items.map((item, i) => [
      String(i + 1),
      item.title.substring(0, 40),
      CATEGORY_LABELS[item.category],
      SEVERITY_LABELS[item.severity],
      item.deadline || "—",
    ]),
    theme: "grid",
    headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 10 }, 3: { cellWidth: 25 } },
    margin: { left: ML, right: MR, top: HEADER_H + 4 },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 3) {
        const sev = items[data.row.index]?.severity;
        if (sev) {
          const col = SEVERITY_COLORS[sev];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fillColor = [col[0], col[1], col[2]];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  y = (doc as any).lastAutoTable?.finalY + 10 || y + 50;

  // ══════════════════════════════════════════
  // SEÇÃO 5: DETALHAMENTO DAS NÃO CONFORMIDADES
  // ══════════════════════════════════════════
  doc.addPage();
  trackSection("5. DETALHAMENTO DAS NÃO CONFORMIDADES");
  y = addSectionTitle(doc, "5. DETALHAMENTO DAS NÃO CONFORMIDADES", HEADER_H + 4, BC);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const norms = ABNT_NORMS[item.category] || [];
    const normRef = norms.map((n) => n.code).join(", ") || "—";

    y = ensureSpace(doc, y, 70);

    // NC header with severity badge
    const sevCol = SEVERITY_COLORS[item.severity];
    doc.setFillColor(sevCol[0], sevCol[1], sevCol[2]);
    doc.roundedRect(ML, y - 2, contentW, 8, 1, 1, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`NC-${String(i + 1).padStart(3, "0")} | ${item.title}`, ML + 4, y + 3);
    doc.text(SEVERITY_LABELS[item.severity], pageW - MR - 4, y + 3, { align: "right" });
    y += 12;

    // Detail table
    autoTable(doc, {
      startY: y,
      body: [
        ["Categoria", CATEGORY_LABELS[item.category]],
        ["Localização", item.location],
        ["Gravidade", SEVERITY_LABELS[item.severity]],
        ["Fundamentação Normativa", normRef],
        ["Responsável", item.responsible || "—"],
        ["Prazo para Correção", item.deadline || "—"],
        ...(item.rdoDate ? [["Data do RDO de Referência", fmtDate(item.rdoDate)]] : []),
      ],
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50, fillColor: [245, 245, 245] } },
      margin: { left: ML, right: MR, top: HEADER_H + 4 },
    });

    y = (doc as any).lastAutoTable?.finalY + 4 || y + 40;

    // Description
    y = ensureSpace(doc, y, 20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BC[0], BC[1], BC[2]);
    doc.text("Descrição da Não Conformidade:", ML, y);
    y += 5;
    y = addBodyText(doc, item.description, y);

    // Corrective action
    y = ensureSpace(doc, y, 20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BC[0], BC[1], BC[2]);
    doc.text("Ação Corretiva Recomendada:", ML, y);
    y += 5;
    y = addBodyText(doc, item.correctiveAction, y);

    // Applicable norms detail
    if (norms.length > 0) {
      y = ensureSpace(doc, y, 15);
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
      const normText = `Normas aplicáveis: ${norms.map((n) => `${n.code} (${n.title})`).join("; ")}`;
      const normLines = doc.splitTextToSize(normText, contentW);
      doc.text(normLines, ML, y);
      y += normLines.length * 3.5 + 6;
    }

    y += 8; // spacing between items
  }

  // ══════════════════════════════════════════
  // SEÇÃO 6: ANÁLISE TÉCNICA E CONCLUSÃO
  // ══════════════════════════════════════════
  onProgress?.("Gerando análise técnica...");
  doc.addPage();
  trackSection("6. ANÁLISE TÉCNICA E CONCLUSÃO");
  y = addSectionTitle(doc, "6. ANÁLISE TÉCNICA E CONCLUSÃO", HEADER_H + 4, BC);

  // Auto-generated analysis
  let analysisText = `Foram identificadas ${items.length} não conformidade(s) na obra "${projectName}", ` +
    `classificadas conforme os níveis de gravidade a seguir: `;

  const sevParts: string[] = [];
  (["critica", "grave", "moderada", "leve"] as NcSeverity[]).forEach((sev) => {
    if (severityCounts[sev] > 0) {
      sevParts.push(`${severityCounts[sev]} ${SEVERITY_LABELS[sev].toLowerCase()}`);
    }
  });
  analysisText += sevParts.join(", ") + ". ";

  if (severityCounts.critica > 0) {
    analysisText += "As não conformidades de nível CRÍTICO exigem ação imediata e podem representar " +
      "risco à segurança estrutural, à integridade dos usuários ou ao cumprimento de obrigações contratuais. " +
      "Recomenda-se a paralisação das atividades relacionadas até a regularização das condições identificadas. ";
  }

  if (severityCounts.grave > 0) {
    analysisText += "As não conformidades de nível GRAVE demandam atenção prioritária e devem ser " +
      "corrigidas dentro dos prazos estabelecidos para evitar agravamento dos impactos técnicos e financeiros. ";
  }

  y = addBodyText(doc, analysisText, y);

  if (conclusions) {
    y += 4;
    y = addBodyText(doc, conclusions, y);
  }

  y += 6;
  y = addBodyText(doc,
    "Todas as não conformidades foram fundamentadas nas normas técnicas da ABNT e regulamentações " +
    "vigentes, conforme detalhado na Seção 3 deste laudo. As ações corretivas recomendadas visam " +
    "restabelecer a conformidade técnica e normativa da obra, devendo ser implementadas dentro " +
    "dos prazos estabelecidos e acompanhadas por profissional habilitado.",
    y
  );

  // ══════════════════════════════════════════
  // SEÇÃO 7: RECOMENDAÇÕES
  // ══════════════════════════════════════════
  y = ensureSpace(doc, y + 8, 40);
  trackSection("7. RECOMENDAÇÕES");
  y = addSectionTitle(doc, "7. RECOMENDAÇÕES", y, BC);

  const recommendations = [
    "Implementar as ações corretivas descritas neste laudo dentro dos prazos estipulados.",
    "Designar responsável técnico para acompanhamento e verificação de cada item não conforme.",
    "Realizar nova vistoria após a conclusão das ações corretivas para verificação de conformidade.",
    "Manter registro fotográfico e documental de todas as etapas de correção.",
    "Comunicar formalmente ao contratante sobre as não conformidades identificadas e as medidas adotadas.",
  ];

  if (severityCounts.critica > 0) {
    recommendations.unshift(
      "AÇÃO IMEDIATA: Paralisar atividades relacionadas às não conformidades de nível CRÍTICO até regularização."
    );
  }

  for (const rec of recommendations) {
    y = ensureSpace(doc, y, 8);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
    const lines = doc.splitTextToSize(`• ${rec}`, contentW - 5);
    doc.text(lines, ML + 3, y);
    y += lines.length * 4.2 + 2;
  }

  // ══════════════════════════════════════════
  // SEÇÃO 8: ASSINATURA TÉCNICA
  // ══════════════════════════════════════════
  doc.addPage();
  trackSection("8. ASSINATURA TÉCNICA");
  y = addSectionTitle(doc, "8. ASSINATURA TÉCNICA", HEADER_H + 4, BC);

  y += 6;
  y = addBodyText(doc,
    "Declaro, para os devidos fins, que as informações contidas neste laudo são verdadeiras e " +
    "foram obtidas por meio de vistoria técnica in loco, análise de registros de obra e " +
    "verificação documental, constituindo minha opinião técnica fundamentada nas normas " +
    "da ABNT e legislação vigente.",
    y
  );

  y += 25;
  const sigX = pageW / 2;
  doc.setDrawColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.setLineWidth(0.4);
  doc.line(sigX - 50, y, sigX + 50, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.text("Responsável Técnico", sigX, y + 6, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (technicalResponsible) {
    doc.text(technicalResponsible, sigX, y + 12, { align: "center" });
  }
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text(creaCau || "CREA / CAU: _______________", sigX, y + 18, { align: "center" });

  y += 35;
  doc.setFontSize(9);
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.text(`Data: ${format(now, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, sigX, y, { align: "center" });

  // ══════════════════════════════════════════
  // SEÇÃO 9: VERIFICAÇÃO
  // ══════════════════════════════════════════
  doc.addPage();
  trackSection("9. INFORMAÇÕES DE VERIFICAÇÃO");
  y = addSectionTitle(doc, "9. INFORMAÇÕES DE VERIFICAÇÃO", HEADER_H + 4, BC);

  const verifyInfo = [
    `Nº do Laudo: ${reportId}`,
    `Hash SHA-256: ${integrityHash}`,
    `Hash Resumido: ${shortHash}`,
    `Data/Hora de Geração: ${now.toISOString()}`,
    `Gerado por: ${userName || "Sistema"}`,
    `Obra: ${projectName}`,
    `Total de Não Conformidades: ${items.length}`,
  ];

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  verifyInfo.forEach((line, i) => doc.text(line, ML, y + i * 7));
  y += verifyInfo.length * 7 + 10;
  doc.addImage(qrDataUrl, "PNG", ML, y, 40, 40);
  doc.setFontSize(8);
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text("Escaneie o QR Code para verificar a autenticidade deste laudo.", ML, y + 46);

  // ══════════════════════════════════════════
  // TOC
  // ══════════════════════════════════════════
  onProgress?.("Finalizando sumário...");
  const tocEntries = bookmarks.filter((b) => b.title !== "SUMÁRIO");
  doc.setPage(tocPageNum);
  let tocY = addSectionTitle(doc, "SUMÁRIO", HEADER_H + 4, BC);

  for (const entry of tocEntries) {
    if (tocY > pageH - MB - 10) break;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
    doc.text(entry.title, ML, tocY);
    const titleW = doc.getTextWidth(entry.title);
    const pageNumStr = String(entry.page);
    const pageNumW = doc.getTextWidth(pageNumStr);
    const tocRight = pageW - MR;
    const dotsStart = ML + titleW + 2;
    const dotsEnd = tocRight - pageNumW - 2;
    if (dotsEnd > dotsStart) {
      doc.setTextColor(180, 180, 180);
      const dotStr = ".".repeat(Math.floor((dotsEnd - dotsStart) / doc.getTextWidth(".")));
      doc.text(dotStr, dotsStart, tocY);
    }
    doc.setTextColor(BC[0], BC[1], BC[2]);
    doc.text(pageNumStr, tocRight, tocY, { align: "right" });
    tocY += 7;
  }

  // ══════════════════════════════════════════
  // HEADERS, FOOTERS & WATERMARK
  // ══════════════════════════════════════════
  onProgress?.("Finalizando documento...");
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) {
      addWatermark(doc, "NÃO CONFORMIDADE");
      addInstitutionalHeader(doc, projectName, companyName, technicalResponsible, logoBase64, BC);
    }
    addFooter(doc, i, totalPages, reportId, companyName, generatedAt);
  }

  const fileName = `Laudo-NC-${projectName.replace(/\s+/g, "-").toLowerCase()}-${format(now, "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
