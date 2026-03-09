import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";

// ── Design Constants (Institutional) ──
const BLUE_TECH: [number, number, number] = [15, 47, 87];    // #0f2f57
const GRAY_LIGHT: [number, number, number] = [232, 237, 244]; // #e8edf4
const ACCENT: [number, number, number] = [44, 123, 229];      // #2c7be5
const GRAY_TEXT: [number, number, number] = [107, 114, 128];
const DARK_TEXT: [number, number, number] = [30, 30, 30];
const WARN_BG: [number, number, number] = [255, 251, 235];
const WARN_BORDER: [number, number, number] = [234, 179, 8];

// Margins: top 30mm, bottom 25mm, left 20mm, right 20mm
const ML = 20;
const MR = 20;
const MT_FIRST = 30;
const MB = 25;
const HEADER_H = 22; // header reserved space on pages > 1
const FOOTER_H = 12;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function fmtDate(d: string) {
  try { return format(new Date(d + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }); } catch { return d; }
}
function fmtDateShort(d: string) {
  try { return format(new Date(d + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
}
function fmtDateTime(d: string) {
  try { return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return d; }
}

async function computeHash(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateQR(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 140, margin: 1 });
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ── Types ──
export interface RdoDia {
  id: string;
  data: string;
  clima: string;
  equipe_total: number;
  horas_trabalhadas: number;
  fase_obra: string | null;
  percentual_fisico_dia: number;
  percentual_fisico_acumulado: number;
  custo_dia: number;
  produtividade_percentual: number;
  risco_dia: string | null;
  observacoes_gerais: string | null;
  is_locked: boolean;
}

export interface RdoPdfOptions {
  projectName: string;
  municipality?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  technicalResponsible?: string;
  userName?: string;
  rdos: RdoDia[];
  aiSummary?: string | null;
  logoBase64?: string | null;
  brandColor?: string;
  includePhotos?: boolean;
  includeActivities?: boolean;
  includeOccurrences?: boolean;
  includeMaterials?: boolean;
  includeDespesas?: boolean;
}

// ── Fetch sub-data ──
async function fetchAtividades(rdoDiaId: string) {
  const { data } = await supabase.from("rdo_atividade").select("*").eq("rdo_dia_id", rdoDiaId).order("created_at");
  return data || [];
}
async function fetchMateriais(rdoDiaId: string) {
  const { data } = await supabase.from("rdo_material").select("*").eq("rdo_dia_id", rdoDiaId).order("created_at");
  return data || [];
}
async function fetchOcorrencias(rdoDiaId: string) {
  const { data } = await supabase.from("rdo_ocorrencia").select("*").eq("rdo_dia_id", rdoDiaId).order("created_at");
  return data || [];
}
async function fetchDespesas(rdoDiaId: string) {
  const { data } = await supabase.from("rdo_despesa_item").select("*").eq("rdo_dia_id", rdoDiaId).order("created_at");
  return data || [];
}
async function fetchFotos(rdoDiaId: string) {
  const { data } = await supabase.from("rdo_foto").select("*").eq("rdo_dia_id", rdoDiaId).order("created_at");
  return (data || []).map((f: any) => {
    const { data: urlData } = supabase.storage.from("diary-photos").getPublicUrl(f.storage_path);
    return { ...f, url: urlData.publicUrl };
  });
}

// ── Chart helpers ──
function drawBarChart(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  data: { label: string; value: number; color: [number, number, number] }[],
  title: string, unit: string, BC: [number, number, number]
) {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BC[0], BC[1], BC[2]);
  doc.text(title, x, y - 4);
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.min(14, (w - 10) / data.length - 2);
  const chartBottom = y + h;
  const chartTop = y + 4;
  const chartH = chartBottom - chartTop;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(x, chartTop, x, chartBottom);
  doc.line(x, chartBottom, x + w, chartBottom);
  for (let i = 0; i <= 4; i++) {
    const gy = chartBottom - (chartH * i) / 4;
    doc.setDrawColor(230, 230, 230);
    doc.line(x + 1, gy, x + w, gy);
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(String(Math.round((maxVal * i) / 4)) + unit, x - 2, gy + 1, { align: "right" });
  }
  data.forEach((d, i) => {
    const bx = x + 6 + i * (barW + 3);
    const bh = (d.value / maxVal) * chartH;
    const by = chartBottom - bh;
    doc.setFillColor(d.color[0], d.color[1], d.color[2]);
    doc.roundedRect(bx, by, barW, bh, 1, 1, "F");
    doc.setFontSize(5);
    doc.setTextColor(80, 80, 80);
    doc.text(d.label.substring(0, 5), bx + barW / 2, chartBottom + 4, { align: "center" });
  });
}

function drawGauge(
  doc: jsPDF, cx: number, cy: number, radius: number,
  value: number, label: string, BC: [number, number, number]
) {
  const r = radius;
  doc.setFillColor(230, 230, 230);
  doc.circle(cx, cy, r, "F");
  const clampedVal = Math.min(100, Math.max(0, value));
  const color: [number, number, number] = clampedVal >= 70 ? [34, 197, 94] : clampedVal >= 50 ? [234, 179, 8] : [239, 68, 68];
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (clampedVal / 100) * 2 * Math.PI;
  const segments = Math.max(2, Math.round(clampedVal / 2));
  const points: [number, number][] = [[cx, cy]];
  for (let i = 0; i <= segments; i++) {
    const a = startAngle + (i / segments) * (endAngle - startAngle);
    points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  if (points.length > 2) {
    doc.setFillColor(color[0], color[1], color[2]);
    for (let i = 1; i < points.length - 1; i++) {
      doc.triangle(points[0][0], points[0][1], points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], "F");
    }
  }
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, r * 0.6, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(`${clampedVal}%`, cx, cy + 2, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text(label, cx, cy + r + 6, { align: "center" });
}

// ── Helpers ──

function addWatermark(doc: jsPDF, text: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
  doc.setFontSize(50);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BLUE_TECH[0], BLUE_TECH[1], BLUE_TECH[2]);
  // Rotated watermark
  const cx = pageW / 2;
  const cy = pageH / 2;
  doc.text(text.toUpperCase(), cx, cy, { align: "center", angle: 45 });
  doc.restoreGraphicsState();
}

function addInstitutionalHeader(
  doc: jsPDF, projectName: string, companyName?: string,
  technicalResponsible?: string, logoBase64?: string | null,
  BC: [number, number, number] = BLUE_TECH
) {
  const pageW = doc.internal.pageSize.getWidth();
  // Blue top line
  doc.setFillColor(BC[0], BC[1], BC[2]);
  doc.rect(0, 0, pageW, 2.5, "F");

  let hx = ML;
  if (logoBase64) {
    try { doc.addImage(logoBase64, "PNG", hx, 4, 12, 6); hx += 14; } catch {}
  }
  // Left: Company/Project
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BC[0], BC[1], BC[2]);
  doc.text("RELATÓRIO TÉCNICO DE ACOMPANHAMENTO DE OBRA", hx, 8);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text(`Obra: ${projectName}`, hx, 12);

  // Right: responsible + date info
  const rightX = pageW - MR;
  if (technicalResponsible) {
    doc.setFontSize(6);
    doc.text(`Resp. Técnico: ${technicalResponsible}`, rightX, 8, { align: "right" });
  }
  if (companyName) {
    doc.text(companyName, rightX, 12, { align: "right" });
  }

  // Divider line
  doc.setDrawColor(BC[0], BC[1], BC[2]);
  doc.setLineWidth(0.3);
  doc.line(ML, 15, pageW - MR, 15);
}

function addInstitutionalFooter(
  doc: jsPDF, pageNum: number, totalPages: number,
  reportId: string, shortHash: string, companyName?: string, generatedAt?: string
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
  doc.text("Relatório Técnico de Acompanhamento de Obra — Documento gerado automaticamente pelo ERP", ML, fy + 4);
  if (generatedAt) {
    doc.text(`Data de geração: ${generatedAt}`, ML, fy + 8);
  }
  doc.text(`Página ${pageNum} de ${totalPages}`, pageW - MR, fy + 4, { align: "right" });
  if (companyName) {
    doc.text(companyName, pageW - MR, fy + 8, { align: "right" });
  }
}

function addSectionTitle(doc: jsPDF, title: string, y: number, BC: [number, number, number] = BLUE_TECH): number {
  const pageW = doc.internal.pageSize.getWidth();
  // Decorative line
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

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - MB) {
    doc.addPage();
    return HEADER_H + 4;
  }
  return y;
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

// ══════════════════════════════════════════════════════
// MAIN GENERATOR
// ══════════════════════════════════════════════════════

export async function generateRdoPDF(
  options: RdoPdfOptions,
  companyId: string,
  onProgress?: (step: string) => void
): Promise<void> {
  const {
    projectName, companyName, companyAddress, companyPhone, technicalResponsible,
    rdos, userName, aiSummary, logoBase64, brandColor,
    includePhotos = true, includeActivities = true, includeOccurrences = true,
    includeMaterials = true, includeDespesas = true,
  } = options;

  const BC: [number, number, number] = brandColor ? hexToRgb(brandColor) : BLUE_TECH;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const now = new Date();
  const generatedAt = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const reportId = `RTAO-${format(now, "yyyyMMddHHmmss")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - ML - MR;

  // Hash & QR
  onProgress?.("Calculando hash de integridade...");
  const integrityHash = await computeHash(JSON.stringify({ reportId, projectName, generated: now.toISOString(), count: rdos.length, ids: rdos.map((r) => r.id) }));
  const shortHash = integrityHash.substring(0, 16).toUpperCase();
  onProgress?.("Gerando QR Code...");
  const qrDataUrl = await generateQR(JSON.stringify({ id: reportId, hash: shortHash, project: projectName, entries: rdos.length, generated: now.toISOString() }));

  const sorted = [...rdos].sort((a, b) => a.data.localeCompare(b.data));
  const period = sorted.length > 0 ? `${fmtDateShort(sorted[0].data)} a ${fmtDateShort(sorted[sorted.length - 1].data)}` : "—";

  // Bookmark tracking
  const bookmarks: { title: string; page: number; children?: { title: string; page: number }[] }[] = [];
  function trackSection(title: string) {
    bookmarks.push({ title, page: doc.getNumberOfPages() });
  }

  // Pre-fetch all sub-data to avoid N+1 queries per RDO during rendering
  onProgress?.("Carregando dados detalhados...");
  const allAtividades: Record<string, any[]> = {};
  const allOcorrencias: Record<string, any[]> = {};
  const allMateriais: Record<string, any[]> = {};
  const allDespesas: Record<string, any[]> = {};
  const allFotos: Record<string, any[]> = {};
  
  for (const rdo of sorted) {
    const [atividades, ocorrencias, materiais, despesas, fotos] = await Promise.all([
      includeActivities ? fetchAtividades(rdo.id) : Promise.resolve([]),
      includeOccurrences ? fetchOcorrencias(rdo.id) : Promise.resolve([]),
      includeMaterials ? fetchMateriais(rdo.id) : Promise.resolve([]),
      includeDespesas ? fetchDespesas(rdo.id) : Promise.resolve([]),
      includePhotos ? fetchFotos(rdo.id) : Promise.resolve([]),
    ]);
    allAtividades[rdo.id] = atividades;
    allOcorrencias[rdo.id] = ocorrencias;
    allMateriais[rdo.id] = materiais;
    allDespesas[rdo.id] = despesas;
    allFotos[rdo.id] = fotos;
  }

  // ══════════════════════════════════════════
  // 1. CAPA INSTITUCIONAL
  // ══════════════════════════════════════════
  onProgress?.("Gerando capa institucional...");

  // Top band
  doc.setFillColor(BC[0], BC[1], BC[2]);
  doc.rect(0, 0, pageW, 50, "F");

  // Logo on cover
  if (logoBase64) {
    try { doc.addImage(logoBase64, "PNG", (pageW - 40) / 2, 8, 40, 20); } catch {}
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text("DIÁRIO TÉCNICO DE EXECUÇÃO", pageW / 2, 38, { align: "center" });
  doc.setFontSize(7);
  doc.text(companyName || "", pageW / 2, 44, { align: "center" });

  // Main title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BC[0], BC[1], BC[2]);
  doc.text("RELATÓRIO TÉCNICO DE", pageW / 2, 72, { align: "center" });
  doc.text("ACOMPANHAMENTO DE OBRA", pageW / 2, 82, { align: "center" });

  // Divider
  doc.setDrawColor(BC[0], BC[1], BC[2]);
  doc.setLineWidth(1);
  doc.line(60, 90, pageW - 60, 90);

  // Project info box
  const infoStartY = 100;
  doc.setFillColor(GRAY_LIGHT[0], GRAY_LIGHT[1], GRAY_LIGHT[2]);
  doc.roundedRect(30, infoStartY, pageW - 60, 70, 2, 2, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);

  const coverInfo: [string, string][] = [
    ["Obra:", projectName],
    ["Município / UF:", (options as any).municipality || "—"],
    ["Empresa Executora:", companyName || "—"],
    ["Endereço:", companyAddress || "—"],
    ["Período:", period],
    ["Data do Relatório:", generatedAt],
    ["Responsável Técnico:", technicalResponsible || "—"],
    ["Nº do Documento:", reportId],
  ];

  coverInfo.forEach(([label, value], i) => {
    const ly = infoStartY + 10 + i * 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label, 38, ly);
    doc.setFont("helvetica", "normal");
    doc.text(value, 90, ly);
  });

  // QR on cover
  doc.addImage(qrDataUrl, "PNG", pageW - 70, infoStartY + 30, 28, 28);
  doc.setFontSize(6);
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text("Autenticidade", pageW - 56, infoStartY + 62, { align: "center" });

  // Bottom band
  doc.setFillColor(BC[0], BC[1], BC[2]);
  doc.rect(0, pageH - 20, pageW, 20, "F");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(`Hash de Integridade (SHA-256): ${shortHash}`, pageW / 2, pageH - 12, { align: "center" });
  doc.text("Documento gerado automaticamente pelo ERP Canteiro Inteli", pageW / 2, pageH - 6, { align: "center" });

  // ══════════════════════════════════════════
  // 2. SUMÁRIO (placeholder, filled at end)
  // ══════════════════════════════════════════
  doc.addPage();
  trackSection("SUMÁRIO");
  const tocPageNum = doc.getNumberOfPages();

  // ══════════════════════════════════════════
  // SECTION 1: IDENTIFICAÇÃO DO RELATÓRIO
  // ══════════════════════════════════════════
  onProgress?.("Gerando identificação...");
  doc.addPage();
  trackSection("1. IDENTIFICAÇÃO DO RELATÓRIO");
  let y = addSectionTitle(doc, "1. IDENTIFICAÇÃO DO RELATÓRIO", HEADER_H + 4, BC);

  autoTable(doc, {
    startY: y,
    head: [["Item", "Informação"]],
    body: [
      ["Obra", projectName],
      ["Empresa Executora", companyName || "—"],
      ["Endereço", companyAddress || "—"],
      ["Telefone", companyPhone || "—"],
      ["Período de Registros", period],
      ["Total de Registros RDO", String(sorted.length)],
      ["Data de Geração", generatedAt],
      ["Gerado por", userName || "Sistema"],
      ["Responsável Técnico", technicalResponsible || "—"],
      ["Nº do Documento", reportId],
    ],
    theme: "grid",
    headStyles: { fillColor: [BC[0], BC[1], BC[2]], font: "helvetica", fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
    margin: { left: ML, right: MR, top: HEADER_H + 4 },
  });

  // ══════════════════════════════════════════
  // SECTION 2: OBJETIVO
  // ══════════════════════════════════════════
  doc.addPage();
  trackSection("2. OBJETIVO");
  y = addSectionTitle(doc, "2. OBJETIVO", HEADER_H + 4, BC);
  y = addBodyText(doc,
    "O presente relatório técnico tem por finalidade registrar as atividades executadas na obra, " +
    "bem como documentar ocorrências relevantes, condições de execução e evidências fotográficas " +
    "referentes ao período do registro. Este documento é parte integrante do Diário de Obra e " +
    "possui caráter técnico e documental, sendo adequado para fins de fiscalização, auditoria " +
    "e processos administrativos.",
    y
  );

  // ══════════════════════════════════════════
  // SECTION 3: METODOLOGIA
  // ══════════════════════════════════════════
  y = ensureSpace(doc, y + 6, 40);
  if (y <= HEADER_H + 10) {
    trackSection("3. METODOLOGIA");
  }
  y = addSectionTitle(doc, "3. METODOLOGIA", y, BC);
  y = addBodyText(doc,
    "As informações contidas neste relatório foram obtidas por meio de acompanhamento técnico " +
    "da obra, registros fotográficos georreferenciados, observações de campo, comunicação com " +
    "a equipe executora e dados inseridos no sistema de gestão de obras (ERP). " +
    "Os registros fotográficos foram obtidos in loco e possuem metadados de data/hora e, quando " +
    "disponível, coordenadas GPS. Os dados quantitativos de produtividade, custo e avanço físico " +
    "foram registrados diariamente pelo responsável técnico da obra.",
    y
  );

  // ══════════════════════════════════════════
  // SECTION 4: DESCRIÇÃO DAS ATIVIDADES
  // ══════════════════════════════════════════
  if (includeActivities) {
    onProgress?.("Gerando descrição das atividades...");
    doc.addPage();
    trackSection("4. DESCRIÇÃO DAS ATIVIDADES EXECUTADAS");
    y = addSectionTitle(doc, "4. DESCRIÇÃO DAS ATIVIDADES EXECUTADAS", HEADER_H + 4, BC);

    for (let idx = 0; idx < sorted.length; idx++) {
      const rdo = sorted[idx];
      const atividades = allAtividades[rdo.id] || [];
      if (atividades.length === 0) continue;

      y = ensureSpace(doc, y, 20);

      // Date sub-header
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(BC[0], BC[1], BC[2]);
      doc.text(`${fmtDate(rdo.data)} — ${rdo.fase_obra || "Fase não informada"}`, ML, y);
      y += 2;

      // Metadata line
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
      doc.text(`Clima: ${rdo.clima}  |  Equipe: ${rdo.equipe_total}  |  Horas: ${rdo.horas_trabalhadas}h  |  Risco: ${rdo.risco_dia || "baixo"}`, ML, y + 4);
      y += 8;

      // Activities as bullet points
      for (const a of atividades) {
        y = ensureSpace(doc, y, 8);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
        const bullet = `• ${a.descricao}`;
        const lines = doc.splitTextToSize(bullet, contentW - 5);
        doc.text(lines, ML + 3, y);
        y += lines.length * 4.2;

        // Status indicators
        doc.setFontSize(7);
        doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
        const statusParts = [
          `Tipo: ${a.tipo_atividade}`,
          a.concluida ? "✓ Concluída" : "○ Em andamento",
          a.impacto_cronograma && a.impacto_cronograma !== "nenhum" ? `Impacto: ${a.impacto_cronograma}` : null,
        ].filter(Boolean).join("  |  ");
        doc.text(statusParts, ML + 6, y);
        y += 5;
      }

      // General observations
      if (rdo.observacoes_gerais) {
        y = ensureSpace(doc, y, 10);
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(80, 80, 80);
        const obsLines = doc.splitTextToSize(`Obs: ${rdo.observacoes_gerais}`, contentW - 10);
        doc.text(obsLines, ML + 3, y);
        y += obsLines.length * 3.8 + 4;
      }

      y += 4; // spacing between days
    }
  }

  // ══════════════════════════════════════════
  // SECTION 5: OCORRÊNCIAS E FATOS RELEVANTES
  // ══════════════════════════════════════════
  if (includeOccurrences) {
    onProgress?.("Gerando ocorrências...");
    const hasAnyOcorrencia = sorted.some((r) => (allOcorrencias[r.id] || []).length > 0);
    
    doc.addPage();
    trackSection("5. OCORRÊNCIAS E FATOS RELEVANTES");
    y = addSectionTitle(doc, "5. OCORRÊNCIAS E FATOS RELEVANTES", HEADER_H + 4, BC);

    if (!hasAnyOcorrencia) {
      y = addBodyText(doc, "Não foram registradas ocorrências relevantes no período analisado.", y);
    } else {
      for (const rdo of sorted) {
        const ocorrencias = allOcorrencias[rdo.id] || [];
        if (ocorrencias.length === 0) continue;

        y = ensureSpace(doc, y, 30);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(BC[0], BC[1], BC[2]);
        doc.text(fmtDate(rdo.data), ML, y);
        y += 6;

        for (const o of ocorrencias) {
          y = ensureSpace(doc, y, 25);

          // Warning box
          doc.setFillColor(WARN_BG[0], WARN_BG[1], WARN_BG[2]);
          doc.setDrawColor(WARN_BORDER[0], WARN_BORDER[1], WARN_BORDER[2]);
          doc.setLineWidth(0.5);

          const descLines = doc.splitTextToSize(o.descricao, contentW - 16);
          const boxH = 14 + descLines.length * 4;
          doc.roundedRect(ML, y, contentW, boxH, 1, 1, "FD");

          // Warning header
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(180, 120, 0);
          doc.text("⚠ OCORRÊNCIA TÉCNICA REGISTRADA", ML + 4, y + 5);

          // Type and impact badges
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
          const meta = [`Tipo: ${o.tipo_ocorrencia}`, `Impacto: ${o.impacto || "baixo"}`];
          if (o.responsavel) meta.push(`Responsável: ${o.responsavel}`);
          if (o.gera_risco_contratual) meta.push("⚠️ RISCO CONTRATUAL");
          doc.text(meta.join("  |  "), ML + 4, y + 10);

          // Description
          doc.setFontSize(9);
          doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
          doc.text(descLines, ML + 4, y + 16);

          y += boxH + 6;
        }
      }
    }
  }

  // ══════════════════════════════════════════
  // SECTION 6: DESPESAS DO PERÍODO
  // ══════════════════════════════════════════
  if (includeDespesas) {
    onProgress?.("Gerando despesas...");
    const hasAnyDespesa = sorted.some((r) => (allDespesas[r.id] || []).filter((d: any) => d.incluir_no_pdf).length > 0);

    if (hasAnyDespesa) {
      doc.addPage();
      trackSection("6. DESPESAS DO PERÍODO");
      y = addSectionTitle(doc, "6. DESPESAS DO PERÍODO", HEADER_H + 4, BC);

      const tipoLabels: Record<string, string> = { material: "Material", mao_de_obra: "Mão de Obra", equipamento: "Equipamento", transporte: "Transporte", outro: "Outro" };
      let totalGeral = 0;

      for (const rdo of sorted) {
        const despesas = (allDespesas[rdo.id] || []).filter((d: any) => d.incluir_no_pdf);
        if (despesas.length === 0) continue;

        y = ensureSpace(doc, y, 20);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(BC[0], BC[1], BC[2]);
        doc.text(fmtDateShort(rdo.data), ML, y);
        y += 2;

        autoTable(doc, {
          startY: y,
          head: [["Descrição", "Tipo", "Qtd", "Unid.", "V. Unit.", "V. Total"]],
          body: despesas.map((d: any) => [
            d.descricao.substring(0, 50),
            tipoLabels[d.tipo] || d.tipo,
            String(d.quantidade || 0),
            d.unidade || "un",
            `R$ ${Number(d.valor_unitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            `R$ ${Number(d.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          ]),
          theme: "grid",
          headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
          styles: { fontSize: 7, cellPadding: 2 },
          margin: { left: ML, right: MR, top: HEADER_H + 4 },
        });
        y = (doc as any).lastAutoTable?.finalY + 2 || y + 20;
        const subtotal = despesas.reduce((s: number, d: any) => s + Number(d.valor_total || 0), 0);
        totalGeral += subtotal;
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
        doc.text(`Subtotal: R$ ${subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, ML, y + 2);
        y += 8;
      }

      y = ensureSpace(doc, y, 10);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(BC[0], BC[1], BC[2]);
      doc.text(`TOTAL GERAL: R$ ${totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, ML, y);
      y += 10;
    }
  }

  // ══════════════════════════════════════════
  // SECTION 7: REGISTRO FOTOGRÁFICO COMENTADO
  // ══════════════════════════════════════════
  if (includePhotos) {
    onProgress?.("Gerando registro fotográfico...");
    const hasAnyPhoto = sorted.some((r) => (allFotos[r.id] || []).length > 0);

    doc.addPage();
    const photoSectionTitle = hasAnyPhoto ? "7. REGISTRO FOTOGRÁFICO COMENTADO" : "7. REGISTRO FOTOGRÁFICO";
    trackSection(photoSectionTitle);
    y = addSectionTitle(doc, photoSectionTitle, HEADER_H + 4, BC);

    if (!hasAnyPhoto) {
      y = addBodyText(doc, "Nenhum registro fotográfico foi inserido no período analisado.", y);
    } else {
      let figureNum = 1;

      for (const rdo of sorted) {
        const fotos = allFotos[rdo.id] || [];
        if (fotos.length === 0) continue;

        y = ensureSpace(doc, y, 20);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(BC[0], BC[1], BC[2]);
        doc.text(fmtDate(rdo.data), ML, y);
        y += 8;

        // Process photos 2 per row
        for (let fi = 0; fi < fotos.length; fi += 2) {
          const isGrid = fi + 1 < fotos.length;
          const photosInRow = isGrid ? [fotos[fi], fotos[fi + 1]] : [fotos[fi]];

          for (let pi = 0; pi < photosInRow.length; pi++) {
            const foto = photosInRow[pi];
            const imgW = isGrid ? (contentW - 6) / 2 : contentW * 0.6;
            const imgH = imgW * 0.75;
            const xOffset = isGrid ? ML + pi * (imgW + 6) : ML + (contentW - imgW) / 2;

            y = ensureSpace(doc, y, imgH + 45);

            onProgress?.(`Carregando foto ${figureNum}...`);
            const base64 = await loadImageAsBase64(foto.url);
            if (base64) {
              try {
                // Photo border frame
                doc.setDrawColor(180, 180, 180);
                doc.setLineWidth(0.3);
                doc.rect(xOffset - 1, y - 1, imgW + 2, imgH + 2);
                doc.addImage(base64, "JPEG", xOffset, y, imgW, imgH);
              } catch { /* skip */ }
            }

            // If grid, only add caption below after both images are placed
            if (!isGrid || pi === 0) {
              // For single image, add caption right after
            }
          }

          // Move y past the image row
          const rowImgW = isGrid ? (contentW - 6) / 2 : contentW * 0.6;
          const rowImgH = rowImgW * 0.75;
          y += rowImgH + 4;

          // Captions for each photo in the row
          for (let pi = 0; pi < photosInRow.length; pi++) {
            const foto = photosInRow[pi];
            const captionX = isGrid ? ML + pi * ((contentW - 6) / 2 + 6) : ML;
            const captionW = isGrid ? (contentW - 6) / 2 : contentW;

            // Figure number
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
            const figTitle = foto.descricao
              ? `Figura ${String(figureNum).padStart(2, "0")} – ${foto.descricao.substring(0, 60)}`
              : `Figura ${String(figureNum).padStart(2, "0")} – ${foto.file_name}`;
            const figLines = doc.splitTextToSize(figTitle, captionW);
            doc.text(figLines, captionX, y);

            let captionY = y + figLines.length * 3.5 + 1;

            // Metadata
            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);

            if (foto.data_captura) {
              doc.text(`Data da captura: ${fmtDateTime(foto.data_captura)}`, captionX, captionY);
              captionY += 3.5;
            }
            if (foto.latitude && foto.longitude) {
              doc.text(`Local (GPS): ${foto.latitude.toFixed(5)}, ${foto.longitude.toFixed(5)}`, captionX, captionY);
              captionY += 3.5;
            }
            if (foto.fase_obra) {
              doc.text(`Fase da obra: ${foto.fase_obra}`, captionX, captionY);
              captionY += 3.5;
            }
            if (foto.tag_risco && foto.tag_risco !== "nenhuma") {
              doc.setTextColor(239, 68, 68);
              doc.text(`Risco: ${foto.tag_risco.toUpperCase()}`, captionX, captionY);
              captionY += 3.5;
              doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
            }

            figureNum++;
          }

          y += 18; // space after caption block
        }
      }
    }
  }

  // ══════════════════════════════════════════
  // SECTION 8: INDICADORES TÉCNICOS
  // ══════════════════════════════════════════
  onProgress?.("Gerando indicadores técnicos...");
  doc.addPage();
  trackSection("8. INDICADORES TÉCNICOS");
  y = addSectionTitle(doc, "8. INDICADORES TÉCNICOS", HEADER_H + 4, BC);

  const totalCost = sorted.reduce((s, r) => s + Number(r.custo_dia || 0), 0);
  const avgTeam = sorted.length > 0 ? Math.round(sorted.reduce((s, r) => s + r.equipe_total, 0) / sorted.length) : 0;
  const avgProd = sorted.length > 0 ? Math.round(sorted.reduce((s, r) => s + Number(r.produtividade_percentual || 0), 0) / sorted.length) : 0;
  const maxPhysical = sorted.length > 0 ? Math.max(...sorted.map((r) => Number(r.percentual_fisico_acumulado || 0))) : 0;
  const totalHours = sorted.reduce((s, r) => s + Number(r.horas_trabalhadas || 0), 0);
  const riskCount: Record<string, number> = {};
  sorted.forEach((r) => { riskCount[r.risco_dia || "baixo"] = (riskCount[r.risco_dia || "baixo"] || 0) + 1; });

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Total de registros RDO", String(sorted.length)],
      ["Período analisado", period],
      ["Custo total acumulado", `R$ ${totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ["Média de equipe/dia", `${avgTeam} pessoas`],
      ["Total de horas trabalhadas", `${totalHours}h`],
      ["Produtividade média", `${avgProd}%`],
      ["Avanço físico acumulado", `${maxPhysical}%`],
      ...Object.entries(riskCount).map(([r, c]) => [`Dias com risco ${r}`, `${c} dia(s)`]),
    ],
    theme: "grid",
    headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
    margin: { left: ML, right: MR, top: HEADER_H + 4 },
  });

  y = (doc as any).lastAutoTable?.finalY + 10 || y + 60;

  // Gauges
  y = ensureSpace(doc, y, 60);
  drawGauge(doc, ML + 25, y + 20, 18, avgProd, "Produtividade Média", BC);
  drawGauge(doc, pageW / 2, y + 20, 18, maxPhysical, "Avanço Físico", BC);
  const highRiskPct = sorted.length > 0 ? Math.round(((riskCount["alto"] || 0) / sorted.length) * 100) : 0;
  drawGauge(doc, pageW - MR - 25, y + 20, 18, highRiskPct, "Risco Alto (%)", BC);
  y += 55;

  // Bar charts
  const last10 = sorted.slice(-10);
  if (last10.length > 0) {
    doc.addPage();
    y = HEADER_H + 4;
    drawBarChart(doc, ML, y + 10, contentW, 55, last10.map((r) => ({
      label: fmtDateShort(r.data).substring(0, 5),
      value: Number(r.produtividade_percentual || 0),
      color: Number(r.produtividade_percentual || 0) >= 70 ? [34, 197, 94] as [number, number, number] : Number(r.produtividade_percentual || 0) >= 50 ? [234, 179, 8] as [number, number, number] : [239, 68, 68] as [number, number, number],
    })), "Produtividade por Dia (últimos 10 registros)", "%", BC);

    drawBarChart(doc, ML, y + 85, contentW, 55, last10.map((r) => ({
      label: fmtDateShort(r.data).substring(0, 5),
      value: Number(r.custo_dia || 0),
      color: BC,
    })), "Custo Diário (R$) — últimos 10 registros", "", BC);
  }

  // ══════════════════════════════════════════
  // SECTION 9: ANÁLISE TÉCNICA
  // ══════════════════════════════════════════
  onProgress?.("Gerando análise técnica...");
  doc.addPage();
  trackSection("9. ANÁLISE TÉCNICA");
  y = addSectionTitle(doc, "9. ANÁLISE TÉCNICA", HEADER_H + 4, BC);

  // Auto-generated technical analysis
  const hasHighRisk = (riskCount["alto"] || 0) > 0;
  const hasMedRisk = (riskCount["medio"] || 0) > 0;
  const allOcorrenciasList = sorted.flatMap((r) => allOcorrencias[r.id] || []);
  const hasContractualRisk = allOcorrenciasList.some((o: any) => o.gera_risco_contratual);

  let analysisText = `As atividades executadas durante o período de ${period} encontram-se ` +
    `registradas de forma detalhada nos itens anteriores deste relatório. `;

  if (avgProd >= 70) {
    analysisText += `A produtividade média de ${avgProd}% indica desempenho satisfatório da equipe executora. `;
  } else if (avgProd >= 50) {
    analysisText += `A produtividade média de ${avgProd}% indica desempenho moderado, sendo recomendável atenção para eventuais melhorias no processo executivo. `;
  } else {
    analysisText += `A produtividade média de ${avgProd}% indica desempenho abaixo do esperado, requerendo análise das causas e implementação de ações corretivas. `;
  }

  if (hasHighRisk) {
    analysisText += `Foram identificados ${riskCount["alto"]} dia(s) com classificação de risco alto, demandando atenção imediata da gestão técnica. `;
  }
  if (hasContractualRisk) {
    analysisText += `ATENÇÃO: Foram identificadas ocorrências com potencial risco contratual, conforme detalhado na seção de ocorrências. `;
  }

  y = addBodyText(doc, analysisText, y);

  // AI summary if available
  if (aiSummary) {
    y = ensureSpace(doc, y + 4, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BC[0], BC[1], BC[2]);
    doc.text("Análise Inteligente (IA)", ML, y);
    y += 5;
    y = addBodyText(doc, aiSummary, y);
  }

  // ══════════════════════════════════════════
  // SECTION 10: CONCLUSÃO TÉCNICA
  // ══════════════════════════════════════════
  doc.addPage();
  trackSection("10. CONCLUSÃO TÉCNICA");
  y = addSectionTitle(doc, "10. CONCLUSÃO TÉCNICA", HEADER_H + 4, BC);

  const fases = [...new Set(sorted.map((r) => r.fase_obra).filter(Boolean))];
  const faseText = fases.length > 0 ? fases.join(", ") : "etapa atual";

  y = addBodyText(doc,
    `Com base nas observações realizadas durante o período analisado (${period}), ` +
    `conclui-se que as atividades registradas correspondem à(s) etapa(s) de ${faseText} ` +
    `prevista(s) para a fase atual da obra. ` +
    `O avanço físico acumulado atingiu ${maxPhysical}%, com custo total de R$ ${totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. ` +
    `A equipe média foi de ${avgTeam} pessoa(s) com ${totalHours} horas totais trabalhadas no período.`,
    y
  );

  if (hasHighRisk || hasMedRisk) {
    y += 4;
    y = addBodyText(doc,
      "Ressalta-se que durante o período foram registrados dias com classificação de risco " +
      (hasHighRisk ? "alto" : "médio") + ", conforme detalhado na seção de indicadores técnicos, " +
      "requerendo monitoramento contínuo pela equipe de gestão.",
      y
    );
  }

  // ══════════════════════════════════════════
  // SECTION 11: RECOMENDAÇÕES
  // ══════════════════════════════════════════
  y = ensureSpace(doc, y + 8, 40);
  if (y <= HEADER_H + 10) {
    trackSection("11. RECOMENDAÇÕES");
  }
  y = addSectionTitle(doc, "11. RECOMENDAÇÕES", y, BC);

  const recommendations: string[] = [];
  if (avgProd < 70) {
    recommendations.push("Avaliar causas da produtividade abaixo da meta e implementar ações corretivas para melhoria do desempenho executivo.");
  }
  if (hasHighRisk) {
    recommendations.push("Intensificar o monitoramento de segurança nos dias com classificação de risco alto, garantindo a implementação de medidas preventivas.");
  }
  if (hasContractualRisk) {
    recommendations.push("Documentar e formalizar as ocorrências com risco contratual junto à contratante para fins de resguardo técnico e jurídico.");
  }
  if (allOcorrenciasList.length > 0) {
    recommendations.push("Manter o registro sistemático de ocorrências para garantir rastreabilidade e possibilitar análises futuras de tendências.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Manter o ritmo de execução observado e a qualidade dos registros técnicos diários.");
    recommendations.push("Continuar o acompanhamento fotográfico detalhado para fins de documentação e auditoria.");
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
  // SECTION 12: ASSINATURA TÉCNICA
  // ══════════════════════════════════════════
  doc.addPage();
  trackSection("12. ASSINATURA TÉCNICA");
  y = addSectionTitle(doc, "12. ASSINATURA TÉCNICA", HEADER_H + 4, BC);

  y += 30;

  // Signature line centered
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
  doc.text("CREA / CAU: _______________", sigX, y + 18, { align: "center" });

  y += 40;

  // Date and location
  doc.setFontSize(9);
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.text(`Data: ${format(now, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, sigX, y, { align: "center" });

  // ══════════════════════════════════════════
  // SECTION 13: VERIFICAÇÃO & QR CODE
  // ══════════════════════════════════════════
  doc.addPage();
  trackSection("13. INFORMAÇÕES DE VERIFICAÇÃO");
  y = addSectionTitle(doc, "13. INFORMAÇÕES DE VERIFICAÇÃO", HEADER_H + 4, BC);

  const verifyInfo = [
    `Nº do Relatório: ${reportId}`,
    `Hash SHA-256: ${integrityHash}`,
    `Hash Resumido: ${shortHash}`,
    `Data/Hora de Geração: ${now.toISOString()}`,
    `Gerado por: ${userName || "Sistema"}`,
    `Obra: ${projectName}`,
    `Total de Registros RDO: ${sorted.length}`,
  ];

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  verifyInfo.forEach((line, i) => doc.text(line, ML, y + i * 7));

  y += verifyInfo.length * 7 + 10;
  doc.addImage(qrDataUrl, "PNG", ML, y, 40, 40);
  doc.setFontSize(8);
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text("Escaneie o QR Code para verificar a autenticidade deste relatório.", ML, y + 46);

  // ══════════════════════════════════════════
  // DRAW TOC WITH PAGE NUMBERS
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

    if (entry.children && entry.children.length > 0) {
      doc.setFontSize(8);
      for (const child of entry.children) {
        if (tocY > pageH - MB - 10) break;
        doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
        const childLabel = `  – ${child.title}`;
        doc.text(childLabel, ML + 8, tocY);
        const cTitleW = doc.getTextWidth(childLabel);
        const cPageStr = String(child.page);
        const cPageW = doc.getTextWidth(cPageStr);
        const cDotsStart = ML + 8 + cTitleW + 2;
        const cDotsEnd = tocRight - cPageW - 2;
        if (cDotsEnd > cDotsStart) {
          doc.setTextColor(200, 200, 200);
          const cDotStr = ".".repeat(Math.floor((cDotsEnd - cDotsStart) / doc.getTextWidth(".")));
          doc.text(cDotStr, cDotsStart, tocY);
        }
        doc.setTextColor(BC[0], BC[1], BC[2]);
        doc.text(cPageStr, tocRight, tocY, { align: "right" });
        tocY += 5;
      }
      tocY += 2;
    }
  }

  // ══════════════════════════════════════════
  // PDF OUTLINE (Bookmarks)
  // ══════════════════════════════════════════
  const outline = (doc as any).outline;
  if (outline && typeof outline.add === "function") {
    bookmarks.forEach((b) => {
      const parent = outline.add(null, b.title, { pageNumber: b.page });
      if (b.children) {
        b.children.forEach((child) => {
          outline.add(parent, child.title, { pageNumber: child.page });
        });
      }
    });
  }

  // ══════════════════════════════════════════
  // HEADERS, FOOTERS & WATERMARK
  // ══════════════════════════════════════════
  onProgress?.("Finalizando documento...");
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Watermark on all pages except cover
    if (i > 1 && companyName) {
      addWatermark(doc, companyName);
    }

    // Header on all pages except cover
    if (i > 1) {
      addInstitutionalHeader(doc, projectName, companyName, technicalResponsible, logoBase64, BC);
    }

    // Footer on all pages
    addInstitutionalFooter(doc, i, totalPages, reportId, shortHash, companyName, generatedAt);
  }

  const fileName = `Laudo-Tecnico-${projectName.replace(/\s+/g, "-").toLowerCase()}-${format(now, "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
