import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";

// ── Design Constants (Institutional) ──
const BLUE_TECH: [number, number, number] = [15, 47, 87];
const GRAY_LIGHT: [number, number, number] = [232, 237, 244];
const ACCENT: [number, number, number] = [44, 123, 229];
const GRAY_TEXT: [number, number, number] = [107, 114, 128];
const DARK_TEXT: [number, number, number] = [30, 30, 30];
const WARN_BG: [number, number, number] = [255, 251, 235];
const WARN_BORDER: [number, number, number] = [234, 179, 8];

// Margins
const ML = 20;
const MR = 20;
const MT_FIRST = 30;
const MB = 25;
const HEADER_H = 22;
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

/**
 * Sanitize text to remove characters unsupported by jsPDF built-in fonts.
 * Replaces common Unicode symbols with ASCII equivalents.
 */
function sanitizeText(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u2713\u2714\u2705]/g, "[OK]")   // ✓ ✔ ✅
    .replace(/[\u25CB\u25EF\u26AA]/g, "[-]")     // ○ ◯ ⚪
    .replace(/[\u26A0\uFE0F]/g, "[!]")           // ⚠ ⚠️
    .replace(/[\u00D8\u00DC\u00CB\u00E6\u00FE]/g, "") // Ø Ü Ë æ þ
    .replace(/[\u2022]/g, "-")                    // •
    .replace(/[^\x00-\x7F\u00C0-\u00FF\u0100-\u017F]/g, (ch) => {
      // Keep Latin Extended but strip other multi-byte
      const code = ch.charCodeAt(0);
      if (code >= 0x00C0 && code <= 0x017F) return ch;
      return "";
    });
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
  numero_sequencial?: number;
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
  includeSideStamp?: boolean;
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

// ── Fetch CREA/CAU from company ──
async function fetchCompanyCreaCau(companyId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from("companies").select("crea_cau").eq("id", companyId).single();
    return data?.crea_cau || null;
  } catch { return null; }
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

function addLogoWatermark(doc: jsPDF, logoBase64: string | null) {
  if (!logoBase64) return;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
  // 60% scale centered — logo at ~126x63mm centered on A4
  const wmW = pageW * 0.6;
  const wmH = wmW * 0.5;
  const wmX = (pageW - wmW) / 2;
  const wmY = (pageH - wmH) / 2;
  try { doc.addImage(logoBase64, "PNG", wmX, wmY, wmW, wmH); } catch {}
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
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BC[0], BC[1], BC[2]);
  doc.text("RELATORIO TECNICO DE ACOMPANHAMENTO DE OBRA", hx, 8);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text(sanitizeText(`Obra: ${projectName}`), hx, 12);

  const rightX = pageW - MR;
  if (technicalResponsible) {
    doc.setFontSize(6);
    doc.text(sanitizeText(`Resp. Tecnico: ${technicalResponsible}`), rightX, 8, { align: "right" });
  }
  if (companyName) {
    doc.text(sanitizeText(companyName), rightX, 12, { align: "right" });
  }

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
  doc.text("Relatorio Tecnico de Acompanhamento de Obra - Documento gerado automaticamente pelo ERP", ML, fy + 4);
  if (generatedAt) {
    doc.text(`Data de geracao: ${generatedAt}`, ML, fy + 8);
  }
  doc.text(`Pagina ${pageNum} de ${totalPages}`, pageW - MR, fy + 4, { align: "right" });
  if (companyName) {
    doc.text(sanitizeText(companyName), pageW - MR, fy + 8, { align: "right" });
  }
}

function addSectionTitle(doc: jsPDF, title: string, y: number, BC: [number, number, number] = BLUE_TECH): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setDrawColor(BC[0], BC[1], BC[2]);
  doc.setLineWidth(0.6);
  doc.line(ML, y - 2, pageW - MR, y - 2);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BC[0], BC[1], BC[2]);
  doc.text(sanitizeText(title), ML, y + 4);

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
  const lines = doc.splitTextToSize(sanitizeText(text), w);
  doc.text(lines, ML, y);
  return y + lines.length * 4.2 + 2;
}

/**
 * Generate a technical description for a photo when none is provided.
 */
function buildPhotoCaption(foto: any, faseObra: string | null): string {
  if (foto.descricao && foto.descricao.trim()) {
    return foto.descricao.trim();
  }
  // Build from metadata
  const parts: string[] = [];
  if (faseObra) parts.push(`Registro fotografico da fase de ${faseObra}`);
  else parts.push("Registro fotografico da obra");
  if (foto.fase_obra) parts.push(`etapa ${foto.fase_obra}`);
  if (foto.tag_risco && foto.tag_risco !== "nenhuma") parts.push(`com identificacao de risco: ${foto.tag_risco}`);
  return parts.join(", ") + ".";
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
    includeMaterials = true, includeDespesas = true, includeSideStamp = true,
  } = options;

  const BC: [number, number, number] = brandColor ? hexToRgb(brandColor) : BLUE_TECH;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const now = new Date();
  const generatedAt = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const reportId = `RTAO-${format(now, "yyyyMMddHHmmss")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - ML - MR;

  // Fetch CREA/CAU
  const creaCau = await fetchCompanyCreaCau(companyId);

  // Hash & QR
  onProgress?.("Calculando hash de integridade...");
  const integrityHash = await computeHash(JSON.stringify({ reportId, projectName, generated: now.toISOString(), count: rdos.length, ids: rdos.map((r) => r.id) }));
  const shortHash = integrityHash.substring(0, 16).toUpperCase();
  onProgress?.("Gerando QR Code...");
  const qrDataUrl = await generateQR(JSON.stringify({ id: reportId, hash: shortHash, project: projectName, entries: rdos.length, generated: now.toISOString() }));

  const sorted = [...rdos].sort((a, b) => a.data.localeCompare(b.data));
  const period = sorted.length > 0 ? `${fmtDateShort(sorted[0].data)} a ${fmtDateShort(sorted[sorted.length - 1].data)}` : "—";

  // Dynamic section counter
  let secNum = 0;
  function nextSec(): number { return ++secNum; }

  // Bookmark tracking
  const bookmarks: { title: string; page: number; children?: { title: string; page: number }[] }[] = [];
  function trackSection(title: string) {
    bookmarks.push({ title, page: doc.getNumberOfPages() });
  }

  // Pre-fetch all sub-data
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

  // Determine which conditional sections will appear
  const hasAnyAtividade = includeActivities && sorted.some((r) => (allAtividades[r.id] || []).length > 0);
  const hasAnyOcorrencia = includeOccurrences && sorted.some((r) => (allOcorrencias[r.id] || []).length > 0);
  const hasAnyDespesaPdf = includeDespesas && sorted.some((r) => (allDespesas[r.id] || []).filter((d: any) => d.incluir_no_pdf).length > 0);
  const hasAnyPhoto = includePhotos && sorted.some((r) => (allFotos[r.id] || []).length > 0);

  // ══════════════════════════════════════════
  // 1. CAPA INSTITUCIONAL (grid vertical - 4 blocos)
  // ══════════════════════════════════════════
  onProgress?.("Gerando capa institucional...");

  const coverCenterX = pageW / 2;
  const coverMaxW = Math.min(140, contentW); // ~520px equivalent at 72dpi
  const coverLeft = (pageW - coverMaxW) / 2;
  const coverRight = coverLeft + coverMaxW;
  const safeTop = 30; // safe-area-top ~120px
  const safeBottom = pageH - 30; // safe-area-bottom ~120px

  // ── Bloco 1: Logo Institucional + Nome da Empresa ──
  doc.setFillColor(BC[0], BC[1], BC[2]);
  doc.rect(0, 0, pageW, 3, "F"); // thin top accent line

  let coverY = safeTop + 10;

  if (logoBase64) {
    try { doc.addImage(logoBase64, "PNG", (pageW - 44) / 2, coverY, 44, 22); } catch {}
    coverY += 28;
  }

  if (companyName) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BC[0], BC[1], BC[2]);
    const companyLines = doc.splitTextToSize(sanitizeText(companyName.toUpperCase()), coverMaxW);
    doc.text(companyLines, coverCenterX, coverY, { align: "center" });
    coverY += companyLines.length * 5.5 + 4;
  }

  // ── Bloco 2: Título do Documento ──
  coverY += 12;
  doc.setDrawColor(BC[0], BC[1], BC[2]);
  doc.setLineWidth(0.8);
  doc.line(coverLeft, coverY, coverRight, coverY);
  coverY += 10;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BC[0], BC[1], BC[2]);
  doc.text("RELATORIO TECNICO DE", coverCenterX, coverY, { align: "center" });
  coverY += 8;
  doc.text("ACOMPANHAMENTO DE OBRA", coverCenterX, coverY, { align: "center" });
  coverY += 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text("Diario de Execucao / Laudo Tecnico", coverCenterX, coverY, { align: "center" });
  coverY += 6;

  doc.setLineWidth(0.8);
  doc.setDrawColor(BC[0], BC[1], BC[2]);
  doc.line(coverLeft, coverY, coverRight, coverY);

  // ── Bloco 3: Identificação do Documento (tabela técnica) ──
  coverY += 14;

  const coverInfo: [string, string][] = [
    ["Obra:", sanitizeText(projectName)],
    ["Municipio / UF:", sanitizeText(options.municipality || "---")],
    ["Empresa Executora:", sanitizeText(companyName || "---")],
    ["Endereco:", sanitizeText(companyAddress || "---")],
    ["Periodo:", period],
    ["Data do Relatorio:", generatedAt],
    ["Resp. Tecnico:", sanitizeText(technicalResponsible || "---")],
    ["CREA / CAU:", sanitizeText(creaCau || "---")],
    ["No do Documento:", reportId],
  ];

  // Use autoTable for structured cover info (prevents overflow)
  autoTable(doc, {
    startY: coverY,
    body: coverInfo.map(([label, value]) => [label, value]),
    theme: "plain",
    styles: { fontSize: 9, cellPadding: { top: 2, bottom: 2, left: 4, right: 4 }, overflow: "linebreak" },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 42, textColor: [BC[0], BC[1], BC[2]] },
      1: { cellWidth: coverMaxW - 42 - 34, textColor: [DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]] },
    },
    margin: { left: coverLeft, right: pageW - coverRight },
    tableWidth: coverMaxW - 34,
    didDrawPage: () => {},
  });

  // QR code to the right of the table
  const tableEndY = (doc as any).lastAutoTable?.finalY || coverY + 60;
  const qrY = Math.max(coverY + 5, tableEndY - 35);
  doc.addImage(qrDataUrl, "PNG", coverRight - 30, qrY - 10, 28, 28);
  doc.setFontSize(6);
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text("Autenticidade", coverRight - 16, qrY + 20, { align: "center" });

  // ── Side stamp (carimbo lateral de status) ──
  if (includeSideStamp) {
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BC[0], BC[1], BC[2]);
    const stampLines = [
      "RELATORIO TECNICO",
      "DOCUMENTO OFICIAL",
      `RDO ${sorted.length > 0 ? `No ${String(sorted.length).padStart(3, "0")}/${format(now, "yyyy")}` : ""}`,
    ];
    stampLines.forEach((line, i) => {
      doc.text(line, 8, pageH / 2 - 10 + i * 5, { angle: 90 });
    });
    doc.restoreGraphicsState();
  }

  // ── Bloco 4: Assinatura Técnica na Capa ──
  const sigBlockY = Math.max(tableEndY + 14, safeBottom - 50);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(coverLeft + 20, sigBlockY, coverRight - 20, sigBlockY);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.text("Responsavel Tecnico", coverCenterX, sigBlockY + 6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  if (technicalResponsible) {
    doc.text(sanitizeText(technicalResponsible), coverCenterX, sigBlockY + 11, { align: "center" });
  }
  doc.text(`CREA / CAU: ${creaCau || "_______________"}`, coverCenterX, sigBlockY + 16, { align: "center" });

  // ── Footer da Capa ──
  doc.setFillColor(BC[0], BC[1], BC[2]);
  doc.rect(0, pageH - 16, pageW, 16, "F");
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`Hash de Integridade (SHA-256): ${shortHash}`, coverCenterX, pageH - 9, { align: "center" });
  doc.text("Documento gerado automaticamente pelo ERP Canteiro Inteli", coverCenterX, pageH - 4, { align: "center" });

  // ══════════════════════════════════════════
  // SUMARIO (placeholder, filled at end)
  // ══════════════════════════════════════════
  doc.addPage();
  trackSection("SUMARIO");
  const tocPageNum = doc.getNumberOfPages();

  // ══════════════════════════════════════════
  // IDENTIFICACAO DO RELATORIO
  // ══════════════════════════════════════════
  onProgress?.("Gerando identificacao...");
  doc.addPage();
  const secIdentificacao = nextSec();
  const secIdentTitle = `${secIdentificacao}. IDENTIFICACAO DO RELATORIO`;
  trackSection(secIdentTitle);
  let y = addSectionTitle(doc, secIdentTitle, HEADER_H + 4, BC);

  autoTable(doc, {
    startY: y,
    head: [["Item", "Informacao"]],
    body: [
      ["Obra", sanitizeText(projectName)],
      ["Municipio / UF", sanitizeText(options.municipality || "---")],
      ["Empresa Executora", sanitizeText(companyName || "---")],
      ["Endereco", sanitizeText(companyAddress || "---")],
      ["Telefone", companyPhone || "---"],
      ["Periodo de Registros", period],
      ["Total de Registros RDO", String(sorted.length)],
      ["Data de Geracao", generatedAt],
      ["Gerado por", userName || "Sistema"],
      ["Responsavel Tecnico", sanitizeText(technicalResponsible || "---")],
      ["CREA / CAU", sanitizeText(creaCau || "---")],
      ["No do Documento", reportId],
    ],
    theme: "grid",
    headStyles: { fillColor: [BC[0], BC[1], BC[2]], font: "helvetica", fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
    margin: { left: ML, right: MR, top: HEADER_H + 4 },
  });

  // ══════════════════════════════════════════
  // OBJETIVO
  // ══════════════════════════════════════════
  doc.addPage();
  const secObjetivo = nextSec();
  const secObjTitle = `${secObjetivo}. OBJETIVO`;
  trackSection(secObjTitle);
  y = addSectionTitle(doc, secObjTitle, HEADER_H + 4, BC);
  y = addBodyText(doc,
    "O presente relatorio tecnico tem por finalidade registrar as atividades executadas na obra, " +
    "bem como documentar ocorrencias relevantes, condicoes de execucao e evidencias fotograficas " +
    "referentes ao periodo do registro. Este documento e parte integrante do Diario de Obra e " +
    "possui carater tecnico e documental, sendo adequado para fins de fiscalizacao, auditoria " +
    "e processos administrativos.",
    y
  );

  // ══════════════════════════════════════════
  // METODOLOGIA
  // ══════════════════════════════════════════
  y = ensureSpace(doc, y + 6, 40);
  const secMetodologia = nextSec();
  const secMetTitle = `${secMetodologia}. METODOLOGIA`;
  if (y <= HEADER_H + 10) {
    trackSection(secMetTitle);
  }
  y = addSectionTitle(doc, secMetTitle, y, BC);
  y = addBodyText(doc,
    "As informacoes contidas neste relatorio foram obtidas por meio de acompanhamento tecnico " +
    "da obra, registros fotograficos georreferenciados, observacoes de campo, comunicacao com " +
    "a equipe executora e dados inseridos no sistema de gestao de obras (ERP). " +
    "Os registros fotograficos foram obtidos in loco e possuem metadados de data/hora e, quando " +
    "disponivel, coordenadas GPS. Os dados quantitativos de produtividade, custo e avanco fisico " +
    "foram registrados diariamente pelo responsavel tecnico da obra.",
    y
  );

  // ══════════════════════════════════════════
  // DESCRICAO DAS ATIVIDADES EXECUTADAS (conditional)
  // ══════════════════════════════════════════
  if (includeActivities) {
    onProgress?.("Gerando descricao das atividades...");
    doc.addPage();
    const secAtiv = nextSec();
    const secAtivTitle = `${secAtiv}. DESCRICAO DAS ATIVIDADES EXECUTADAS`;
    trackSection(secAtivTitle);
    y = addSectionTitle(doc, secAtivTitle, HEADER_H + 4, BC);

    if (!hasAnyAtividade) {
      y = addBodyText(doc, "Nao foram registradas atividades detalhadas no periodo analisado.", y);
    } else {
      for (let idx = 0; idx < sorted.length; idx++) {
        const rdo = sorted[idx];
        const atividades = allAtividades[rdo.id] || [];
        if (atividades.length === 0) continue;

        y = ensureSpace(doc, y, 20);

        // Date sub-header
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(BC[0], BC[1], BC[2]);
        const rdoNumLabel = rdo.numero_sequencial ? `RDO ${String(rdo.numero_sequencial).padStart(3, "0")} - ` : "";
        doc.text(sanitizeText(`${rdoNumLabel}${fmtDate(rdo.data)} - ${rdo.fase_obra || "Fase nao informada"}`), ML, y);
        y += 2;

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
        doc.text(`Clima: ${rdo.clima}  |  Equipe: ${rdo.equipe_total}  |  Horas: ${rdo.horas_trabalhadas}h  |  Risco: ${rdo.risco_dia || "baixo"}`, ML, y + 4);
        y += 8;

        // Subtitle
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
        doc.text("Atividades executadas:", ML, y);
        y += 5;

        for (const a of atividades) {
          y = ensureSpace(doc, y, 8);
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
          const bullet = `- ${sanitizeText(a.descricao)}`;
          const lines = doc.splitTextToSize(bullet, contentW - 5);
          doc.text(lines, ML + 3, y);
          y += lines.length * 4.2;

          // Status indicators (ASCII only)
          doc.setFontSize(7);
          doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
          const statusParts = [
            `Tipo: ${a.tipo_atividade}`,
            a.concluida ? "[OK] Concluida" : "[-] Em andamento",
            a.impacto_cronograma && a.impacto_cronograma !== "nenhum" ? `Impacto: ${a.impacto_cronograma}` : null,
          ].filter(Boolean).join("  |  ");
          doc.text(statusParts, ML + 6, y);
          y += 5;
        }

        if (rdo.observacoes_gerais) {
          y = ensureSpace(doc, y, 10);
          doc.setFontSize(8);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(80, 80, 80);
          const obsLines = doc.splitTextToSize(sanitizeText(`Obs: ${rdo.observacoes_gerais}`), contentW - 10);
          doc.text(obsLines, ML + 3, y);
          y += obsLines.length * 3.8 + 4;
        }

        y += 4;
      }
    }
  }

  // ══════════════════════════════════════════
  // OCORRENCIAS E FATOS RELEVANTES (conditional)
  // ══════════════════════════════════════════
  if (includeOccurrences) {
    onProgress?.("Gerando ocorrencias...");
    doc.addPage();
    const secOcorr = nextSec();
    const secOcorrTitle = `${secOcorr}. OCORRENCIAS E FATOS RELEVANTES`;
    trackSection(secOcorrTitle);
    y = addSectionTitle(doc, secOcorrTitle, HEADER_H + 4, BC);

    if (!hasAnyOcorrencia) {
      y = addBodyText(doc, "Nao foram registradas ocorrencias relevantes no periodo analisado.", y);
    } else {
      for (const rdo of sorted) {
        const ocorrencias = allOcorrencias[rdo.id] || [];
        if (ocorrencias.length === 0) continue;

        y = ensureSpace(doc, y, 30);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(BC[0], BC[1], BC[2]);
        const rdoNumLabel = rdo.numero_sequencial ? `RDO ${String(rdo.numero_sequencial).padStart(3, "0")} - ` : "";
        doc.text(`${rdoNumLabel}${fmtDate(rdo.data)}`, ML, y);
        y += 6;

        for (const o of ocorrencias) {
          y = ensureSpace(doc, y, 25);

          doc.setFillColor(WARN_BG[0], WARN_BG[1], WARN_BG[2]);
          doc.setDrawColor(WARN_BORDER[0], WARN_BORDER[1], WARN_BORDER[2]);
          doc.setLineWidth(0.5);

          const descLines = doc.splitTextToSize(sanitizeText(o.descricao), contentW - 16);
          const boxH = 14 + descLines.length * 4;
          doc.roundedRect(ML, y, contentW, boxH, 1, 1, "FD");

          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(180, 120, 0);
          doc.text("[!] OCORRENCIA TECNICA REGISTRADA", ML + 4, y + 5);

          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
          const meta = [`Tipo: ${o.tipo_ocorrencia}`, `Impacto: ${o.impacto || "baixo"}`];
          if (o.responsavel) meta.push(`Responsavel: ${sanitizeText(o.responsavel)}`);
          if (o.gera_risco_contratual) meta.push("[!] RISCO CONTRATUAL");
          doc.text(meta.join("  |  "), ML + 4, y + 10);

          doc.setFontSize(9);
          doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
          doc.text(descLines, ML + 4, y + 16);

          y += boxH + 6;
        }
      }
    }
  }

  // ══════════════════════════════════════════
  // DESPESAS DO PERIODO (conditional)
  // ══════════════════════════════════════════
  if (includeDespesas && hasAnyDespesaPdf) {
    onProgress?.("Gerando despesas...");
    doc.addPage();
    const secDesp = nextSec();
    const secDespTitle = `${secDesp}. DESPESAS DO PERIODO`;
    trackSection(secDespTitle);
    y = addSectionTitle(doc, secDespTitle, HEADER_H + 4, BC);

    const tipoLabels: Record<string, string> = { material: "Material", mao_de_obra: "Mao de Obra", equipamento: "Equipamento", transporte: "Transporte", outro: "Outro" };
    let totalGeral = 0;

    for (const rdo of sorted) {
      const despesas = (allDespesas[rdo.id] || []).filter((d: any) => d.incluir_no_pdf);
      if (despesas.length === 0) continue;

      y = ensureSpace(doc, y, 20);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(BC[0], BC[1], BC[2]);
      const rdoNumLabel = rdo.numero_sequencial ? `RDO ${String(rdo.numero_sequencial).padStart(3, "0")} - ` : "";
      doc.text(`${rdoNumLabel}${fmtDateShort(rdo.data)}`, ML, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Descricao", "Tipo", "Qtd", "Unid.", "V. Unit.", "V. Total"]],
        body: despesas.map((d: any) => [
          sanitizeText(d.descricao.substring(0, 50)),
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

  // ══════════════════════════════════════════
  // REGISTRO FOTOGRAFICO COMENTADO (conditional)
  // ══════════════════════════════════════════
  if (includePhotos) {
    onProgress?.("Gerando registro fotografico...");
    doc.addPage();
    const secFoto = nextSec();
    const secFotoTitle = `${secFoto}. REGISTRO FOTOGRAFICO COMENTADO`;
    trackSection(secFotoTitle);
    y = addSectionTitle(doc, secFotoTitle, HEADER_H + 4, BC);

    if (!hasAnyPhoto) {
      y = addBodyText(doc, "Nenhum registro fotografico foi inserido no periodo analisado.", y);
    } else {
      let figureNum = 1;

      for (const rdo of sorted) {
        const fotos = allFotos[rdo.id] || [];
        if (fotos.length === 0) continue;

        y = ensureSpace(doc, y, 20);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(BC[0], BC[1], BC[2]);
        const rdoNumLabel = rdo.numero_sequencial ? `RDO ${String(rdo.numero_sequencial).padStart(3, "0")} - ` : "";
        doc.text(`${rdoNumLabel}${fmtDate(rdo.data)}`, ML, y);
        y += 8;

        // Process photos 2 per row
        for (let fi = 0; fi < fotos.length; fi += 2) {
          const isGrid = fi + 1 < fotos.length;
          const photosInRow = isGrid ? [fotos[fi], fotos[fi + 1]] : [fotos[fi]];

          const imgW = isGrid ? (contentW - 6) / 2 : contentW * 0.6;
          const imgH = imgW * 0.75;

          y = ensureSpace(doc, y, imgH + 55);

          for (let pi = 0; pi < photosInRow.length; pi++) {
            const foto = photosInRow[pi];
            const xOffset = isGrid ? ML + pi * (imgW + 6) : ML + (contentW - imgW) / 2;

            onProgress?.(`Carregando foto ${figureNum + pi}...`);
            const base64 = await loadImageAsBase64(foto.url);
            if (base64) {
              try {
                doc.setDrawColor(180, 180, 180);
                doc.setLineWidth(0.3);
                doc.rect(xOffset - 1, y - 1, imgW + 2, imgH + 2);
                doc.addImage(base64, "JPEG", xOffset, y, imgW, imgH);
              } catch { /* skip */ }
            }
          }

          // Move y past images
          y += imgH + 4;

          // Captions
          for (let pi = 0; pi < photosInRow.length; pi++) {
            const foto = photosInRow[pi];
            const captionX = isGrid ? ML + pi * ((contentW - 6) / 2 + 6) : ML;
            const captionW = isGrid ? (contentW - 6) / 2 : contentW;

            const caption = buildPhotoCaption(foto, rdo.fase_obra);

            // Figure title
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
            const figTitle = `Figura ${String(figureNum).padStart(2, "0")} - ${sanitizeText(caption.substring(0, 80))}`;
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

            // Technical description block
            doc.setFontSize(7);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(80, 80, 80);
            const techDesc = sanitizeText(caption);
            const techLines = doc.splitTextToSize(`Descricao tecnica: ${techDesc}`, captionW);
            doc.text(techLines, captionX, captionY);
            captionY += techLines.length * 3.2;

            figureNum++;
          }

          y += 22; // spacing after caption block (12px ~= 3.2mm, but generous spacing)
        }
      }
    }
  }

  // ══════════════════════════════════════════
  // INDICADORES TECNICOS
  // ══════════════════════════════════════════
  onProgress?.("Gerando indicadores tecnicos...");
  doc.addPage();
  const secIndic = nextSec();
  const secIndicTitle = `${secIndic}. INDICADORES TECNICOS`;
  trackSection(secIndicTitle);
  y = addSectionTitle(doc, secIndicTitle, HEADER_H + 4, BC);

  const totalCost = sorted.reduce((s, r) => s + Number(r.custo_dia || 0), 0);
  const avgTeam = sorted.length > 0 ? Math.round(sorted.reduce((s, r) => s + r.equipe_total, 0) / sorted.length) : 0;
  const avgProd = sorted.length > 0 ? Math.round(sorted.reduce((s, r) => s + Number(r.produtividade_percentual || 0), 0) / sorted.length) : 0;
  const maxPhysical = sorted.length > 0 ? Math.max(...sorted.map((r) => Number(r.percentual_fisico_acumulado || 0))) : 0;
  const totalHours = sorted.reduce((s, r) => s + Number(r.horas_trabalhadas || 0), 0);
  const riskCount: Record<string, number> = {};
  sorted.forEach((r) => { riskCount[r.risco_dia || "baixo"] = (riskCount[r.risco_dia || "baixo"] || 0) + 1; });

  // Show note when indicators are zero
  const allIndicatorsZero = avgProd === 0 && maxPhysical === 0 && totalCost === 0;

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Total de registros RDO", String(sorted.length)],
      ["Periodo analisado", period],
      ["Custo total acumulado", totalCost > 0 ? `R$ ${totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Nao informado"],
      ["Media de equipe/dia", avgTeam > 0 ? `${avgTeam} pessoas` : "Nao informado"],
      ["Total de horas trabalhadas", totalHours > 0 ? `${totalHours}h` : "Nao informado"],
      ["Produtividade media", avgProd > 0 ? `${avgProd}%` : "Nao informado"],
      ["Avanco fisico acumulado", maxPhysical > 0 ? `${maxPhysical}%` : "Nao informado"],
      ...Object.entries(riskCount).map(([r, c]) => [`Dias com risco ${r}`, `${c} dia(s)`]),
    ],
    theme: "grid",
    headStyles: { fillColor: [BC[0], BC[1], BC[2]], font: "helvetica", fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
    margin: { left: ML, right: MR, top: HEADER_H + 4 },
  });

  y = (doc as any).lastAutoTable?.finalY + 8 || y + 60;

  if (allIndicatorsZero) {
    y = ensureSpace(doc, y, 15);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
    const noteLines = doc.splitTextToSize(
      "Nota: Os indicadores acima apresentam valores nao informados pois os campos de produtividade, " +
      "avanco fisico e custo diario nao foram preenchidos nos registros do periodo. " +
      "Para obter indicadores completos, preencha esses campos ao registrar cada RDO.",
      contentW
    );
    doc.text(noteLines, ML, y);
    y += noteLines.length * 3.8 + 4;
  }

  // Visual gauges (only if we have data)
  if (!allIndicatorsZero) {
    y = ensureSpace(doc, y, 50);
    const gaugeY = y + 20;
    const gaugeSpacing = contentW / 3;
    drawGauge(doc, ML + gaugeSpacing * 0.5, gaugeY, 14, avgProd, "Produtividade", BC);
    drawGauge(doc, ML + gaugeSpacing * 1.5, gaugeY, 14, maxPhysical, "Avanco Fisico", BC);
    const costPct = totalCost > 0 ? Math.min(100, Math.round((totalCost / Math.max(totalCost * 1.2, 1)) * 100)) : 0;
    drawGauge(doc, ML + gaugeSpacing * 2.5, gaugeY, 14, costPct, "Custo Exec.", BC);
    y = gaugeY + 30;

    // Bar chart for team
    if (sorted.length > 1 && sorted.length <= 15) {
      y = ensureSpace(doc, y + 5, 50);
      const barData = sorted.map((r) => ({
        label: fmtDateShort(r.data),
        value: r.equipe_total,
        color: ACCENT as [number, number, number],
      }));
      drawBarChart(doc, ML, y, contentW, 35, barData, "Equipe por Dia", "", BC);
      y += 45;
    }
  }

  // ══════════════════════════════════════════
  // ANALISE TECNICA
  // ══════════════════════════════════════════
  onProgress?.("Gerando analise tecnica...");
  doc.addPage();
  const secAnalise = nextSec();
  const secAnaliseTitle = `${secAnalise}. ANALISE TECNICA`;
  trackSection(secAnaliseTitle);
  y = addSectionTitle(doc, secAnaliseTitle, HEADER_H + 4, BC);

  const hasHighRisk = (riskCount["alto"] || 0) > 0;
  const hasMedRisk = (riskCount["medio"] || 0) > 0;
  const allOcorrenciasList = sorted.flatMap((r) => allOcorrencias[r.id] || []);
  const hasContractualRisk = allOcorrenciasList.some((o: any) => o.gera_risco_contratual);

  let analysisText = `As atividades executadas durante o periodo de ${period} encontram-se ` +
    `registradas de forma detalhada nos itens anteriores deste relatorio. `;

  if (allIndicatorsZero) {
    analysisText += "Os indicadores quantitativos de produtividade e avanco fisico nao foram preenchidos nos registros do periodo, " +
      "impossibilitando uma analise comparativa detalhada. Recomenda-se o preenchimento desses campos nos proximos registros. ";
  } else if (avgProd >= 70) {
    analysisText += `A produtividade media de ${avgProd}% indica desempenho satisfatorio da equipe executora. `;
  } else if (avgProd >= 50) {
    analysisText += `A produtividade media de ${avgProd}% indica desempenho moderado, sendo recomendavel atencao para eventuais melhorias no processo executivo. `;
  } else {
    analysisText += `A produtividade media de ${avgProd}% indica desempenho abaixo do esperado, requerendo analise das causas e implementacao de acoes corretivas. `;
  }

  if (hasHighRisk) {
    analysisText += `Foram identificados ${riskCount["alto"]} dia(s) com classificacao de risco alto, demandando atencao imediata da gestao tecnica. `;
  }
  if (hasContractualRisk) {
    analysisText += `ATENCAO: Foram identificadas ocorrencias com potencial risco contratual, conforme detalhado na secao de ocorrencias. `;
  }

  y = addBodyText(doc, analysisText, y);

  if (aiSummary) {
    y = ensureSpace(doc, y + 4, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BC[0], BC[1], BC[2]);
    doc.text("Analise Inteligente (IA)", ML, y);
    y += 5;
    y = addBodyText(doc, sanitizeText(aiSummary), y);
  }

  // ══════════════════════════════════════════
  // CONCLUSAO TECNICA
  // ══════════════════════════════════════════
  doc.addPage();
  const secConclusao = nextSec();
  const secConcTitle = `${secConclusao}. CONCLUSAO TECNICA`;
  trackSection(secConcTitle);
  y = addSectionTitle(doc, secConcTitle, HEADER_H + 4, BC);

  const fases = [...new Set(sorted.map((r) => r.fase_obra).filter(Boolean))];
  const faseText = fases.length > 0 ? fases.join(", ") : "etapa atual";

  let conclusionText = `Com base nas observacoes realizadas durante o periodo analisado (${period}), ` +
    `conclui-se que as atividades registradas correspondem a(s) etapa(s) de ${faseText} ` +
    `prevista(s) para a fase atual da obra. `;

  if (!allIndicatorsZero) {
    conclusionText += `O avanco fisico acumulado atingiu ${maxPhysical}%, com custo total de R$ ${totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. ` +
      `A equipe media foi de ${avgTeam} pessoa(s) com ${totalHours} horas totais trabalhadas no periodo.`;
  } else {
    conclusionText += `A equipe media foi de ${avgTeam} pessoa(s) com ${totalHours} horas totais trabalhadas no periodo. ` +
      `Os demais indicadores quantitativos nao foram preenchidos.`;
  }

  y = addBodyText(doc, conclusionText, y);

  if (hasHighRisk || hasMedRisk) {
    y += 4;
    y = addBodyText(doc,
      "Ressalta-se que durante o periodo foram registrados dias com classificacao de risco " +
      (hasHighRisk ? "alto" : "medio") + ", conforme detalhado na secao de indicadores tecnicos, " +
      "requerendo monitoramento continuo pela equipe de gestao.",
      y
    );
  }

  // ══════════════════════════════════════════
  // RECOMENDACOES
  // ══════════════════════════════════════════
  y = ensureSpace(doc, y + 8, 40);
  const secRecom = nextSec();
  const secRecomTitle = `${secRecom}. RECOMENDACOES`;
  if (y <= HEADER_H + 10) {
    trackSection(secRecomTitle);
  }
  y = addSectionTitle(doc, secRecomTitle, y, BC);

  const recommendations: string[] = [];
  if (allIndicatorsZero) {
    recommendations.push("Preencher os campos de produtividade, avanco fisico e custo diario nos proximos registros de RDO para permitir analise quantitativa completa.");
  }
  if (avgProd > 0 && avgProd < 70) {
    recommendations.push("Avaliar causas da produtividade abaixo da meta e implementar acoes corretivas para melhoria do desempenho executivo.");
  }
  if (hasHighRisk) {
    recommendations.push("Intensificar o monitoramento de seguranca nos dias com classificacao de risco alto, garantindo a implementacao de medidas preventivas.");
  }
  if (hasContractualRisk) {
    recommendations.push("Documentar e formalizar as ocorrencias com risco contratual junto a contratante para fins de resguardo tecnico e juridico.");
  }
  if (allOcorrenciasList.length > 0) {
    recommendations.push("Manter o registro sistematico de ocorrencias para garantir rastreabilidade e possibilitar analises futuras de tendencias.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Manter o ritmo de execucao observado e a qualidade dos registros tecnicos diarios.");
    recommendations.push("Continuar o acompanhamento fotografico detalhado para fins de documentacao e auditoria.");
  }

  for (const rec of recommendations) {
    y = ensureSpace(doc, y, 8);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
    const lines = doc.splitTextToSize(`- ${rec}`, contentW - 5);
    doc.text(lines, ML + 3, y);
    y += lines.length * 4.2 + 2;
  }

  // ══════════════════════════════════════════
  // ASSINATURA TECNICA
  // ══════════════════════════════════════════
  doc.addPage();
  const secAssina = nextSec();
  const secAssinaTitle = `${secAssina}. ASSINATURA TECNICA`;
  trackSection(secAssinaTitle);
  y = addSectionTitle(doc, secAssinaTitle, HEADER_H + 4, BC);

  y += 30;

  const sigX = pageW / 2;
  doc.setDrawColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.setLineWidth(0.4);
  doc.line(sigX - 50, y, sigX + 50, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.text("Responsavel Tecnico", sigX, y + 6, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (technicalResponsible) {
    doc.text(sanitizeText(technicalResponsible), sigX, y + 12, { align: "center" });
  }
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text(`CREA / CAU: ${creaCau || "_______________"}`, sigX, y + 18, { align: "center" });

  y += 40;

  doc.setFontSize(9);
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.text(`Data: ${format(now, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, sigX, y, { align: "center" });

  // ══════════════════════════════════════════
  // INFORMACOES DE VERIFICACAO
  // ══════════════════════════════════════════
  doc.addPage();
  const secVerif = nextSec();
  const secVerifTitle = `${secVerif}. INFORMACOES DE VERIFICACAO`;
  trackSection(secVerifTitle);
  y = addSectionTitle(doc, secVerifTitle, HEADER_H + 4, BC);

  const verifyInfo = [
    `No do Relatorio: ${reportId}`,
    `Hash SHA-256: ${integrityHash}`,
    `Hash Resumido: ${shortHash}`,
    `Data/Hora de Geracao: ${now.toISOString()}`,
    `Gerado por: ${userName || "Sistema"}`,
    `Obra: ${sanitizeText(projectName)}`,
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
  doc.text("Escaneie o QR Code para verificar a autenticidade deste relatorio.", ML, y + 46);

  // ══════════════════════════════════════════
  // DRAW TOC WITH PAGE NUMBERS
  // ══════════════════════════════════════════
  onProgress?.("Finalizando sumario...");
  const tocEntries = bookmarks.filter((b) => b.title !== "SUMARIO");
  doc.setPage(tocPageNum);
  let tocY = addSectionTitle(doc, "SUMARIO", HEADER_H + 4, BC);

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
        const childLabel = `  - ${child.title}`;
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
  // HEADERS, FOOTERS & WATERMARK (post-processing)
  // ══════════════════════════════════════════
  onProgress?.("Finalizando documento...");
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Logo watermark on ALL pages (behind content, low opacity)
    addLogoWatermark(doc, logoBase64 || null);

    // Header only on pages after cover (page 1 = cover, no header)
    if (i > 1) {
      addInstitutionalHeader(doc, projectName, companyName, technicalResponsible, logoBase64, BC);
    }

    // Footer on all pages (cover has its own footer already but standard on rest)
    if (i > 1) {
      addInstitutionalFooter(doc, i, totalPages, reportId, shortHash, companyName, generatedAt);
    }
  }

  const fileName = `Laudo-Tecnico-${projectName.replace(/\s+/g, "-").toLowerCase()}-${format(now, "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
