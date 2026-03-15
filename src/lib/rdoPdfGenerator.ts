import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";

// ── Design Constants ──
const BLUE_TECH: [number, number, number] = [15, 47, 87];
const GRAY_LIGHT: [number, number, number] = [232, 237, 244];
const ACCENT: [number, number, number] = [44, 123, 229];
const GRAY_TEXT: [number, number, number] = [107, 114, 128];
const DARK_TEXT: [number, number, number] = [30, 30, 30];
const WARN_BG: [number, number, number] = [255, 251, 235];
const WARN_BORDER: [number, number, number] = [234, 179, 8];

const ML = 20;
const MR = 20;
const MB = 25;
const HEADER_H = 18;
const USABLE_TOP = HEADER_H + 4;
const BLOCK_SPACING = 4;

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

function sanitizeText(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u2713\u2714\u2705]/g, "[OK]")
    .replace(/[\u25CB\u25EF\u26AA]/g, "[-]")
    .replace(/[\u26A0\uFE0F]/g, "[!]")
    .replace(/[\u00D8\u00DC\u00CB\u00E6\u00FE]/g, "")
    .replace(/[\u2022]/g, "-")
    .replace(/[^\x00-\x7F\u00C0-\u00FF\u0100-\u017F]/g, (ch) => {
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

function buildPhotoCaption(foto: any, faseObra: string | null): string {
  if (foto.descricao && foto.descricao.trim()) return foto.descricao.trim();
  const parts: string[] = [];
  if (faseObra) parts.push(`Registro fotografico da fase de ${faseObra}`);
  else parts.push("Registro fotografico da obra");
  if (foto.fase_obra) parts.push(`etapa ${foto.fase_obra}`);
  if (foto.tag_risco && foto.tag_risco !== "nenhuma") parts.push(`com identificacao de risco: ${foto.tag_risco}`);
  return parts.join(", ") + ".";
}

// ── Types ──
export interface RdoDia {
  id: string; data: string; clima: string; equipe_total: number;
  horas_trabalhadas: number; fase_obra: string | null;
  percentual_fisico_dia: number; percentual_fisico_acumulado: number;
  custo_dia: number; produtividade_percentual: number;
  risco_dia: string | null; observacoes_gerais: string | null;
  is_locked: boolean; numero_sequencial?: number;
}

export interface RdoPdfOptions {
  projectName: string; municipality?: string; companyName?: string;
  companyAddress?: string; companyPhone?: string; technicalResponsible?: string;
  userName?: string; rdos: RdoDia[]; aiSummary?: string | null;
  logoBase64?: string | null; brandColor?: string;
  includePhotos?: boolean; includeActivities?: boolean;
  includeOccurrences?: boolean; includeMaterials?: boolean;
  includeDespesas?: boolean; includeSideStamp?: boolean;
}

// ── Fetch sub-data ──
async function fetchAtividades(id: string) {
  const { data } = await supabase.from("rdo_atividade").select("*").eq("rdo_dia_id", id).order("hora", { ascending: true, nullsFirst: false });
  return data || [];
}
async function fetchMateriais(id: string) {
  const { data } = await supabase.from("rdo_material").select("*").eq("rdo_dia_id", id).order("created_at");
  return data || [];
}
async function fetchOcorrencias(id: string) {
  const { data } = await supabase.from("rdo_ocorrencia").select("*").eq("rdo_dia_id", id).order("created_at");
  return data || [];
}
async function fetchDespesas(id: string) {
  const { data } = await supabase.from("rdo_despesa_item").select("*").eq("rdo_dia_id", id).order("created_at");
  return data || [];
}
async function fetchFotos(id: string) {
  const { data } = await supabase.from("rdo_foto").select("*").eq("rdo_dia_id", id).order("created_at");
  return (data || []).map((f: any) => {
    const { data: urlData } = supabase.storage.from("diary-photos").getPublicUrl(f.storage_path);
    return { ...f, url: urlData.publicUrl };
  });
}
async function fetchCompanyCreaCau(companyId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from("companies").select("crea_cau").eq("id", companyId).single();
    return data?.crea_cau || null;
  } catch { return null; }
}

// ══════════════════════════════════════════════════════
// LAYOUT ENGINE — Component-based vertical stack
// ══════════════════════════════════════════════════════

type RGB = [number, number, number];

interface LayoutContext {
  doc: jsPDF;
  pageW: number;
  pageH: number;
  contentW: number;
  usableTop: number;
  usableBottom: number;
  BC: RGB;
}

/** Measurable/renderable block */
interface PdfBlock {
  /** Estimate the height this block needs */
  measure(ctx: LayoutContext): number;
  /** Render the block at the given y position. Returns the new y after rendering. */
  render(ctx: LayoutContext, y: number): number;
  /** If true, force a new page before this block */
  forceNewPage?: boolean;
}

/** Measures text height accounting for line wrapping */
function measureTextHeight(doc: jsPDF, text: string, width: number, fontSize: number, lineHeight: number = 4.2): number {
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(sanitizeText(text), width);
  return lines.length * lineHeight + 2;
}

/** Measures an array of text lines */
function measureLines(doc: jsPDF, texts: string[], width: number, fontSize: number, lineHeight: number = 4.2): number {
  doc.setFontSize(fontSize);
  let h = 0;
  for (const t of texts) {
    const lines = doc.splitTextToSize(sanitizeText(t), width);
    h += lines.length * lineHeight + 2;
  }
  return h;
}

// ── Layout Engine ──
class VerticalLayoutEngine {
  private ctx: LayoutContext;
  private currentY: number;

  constructor(ctx: LayoutContext) {
    this.ctx = ctx;
    this.currentY = ctx.usableTop;
  }

  getY(): number { return this.currentY; }
  setY(y: number) { this.currentY = y; }

  /** Ensure there's enough space; if not, add a page and reset Y */
  ensureSpace(needed: number): number {
    if (this.currentY + needed > this.ctx.usableBottom) {
      this.ctx.doc.addPage();
      this.currentY = this.ctx.usableTop;
    }
    return this.currentY;
  }

  /** Render a block with automatic pagination */
  renderBlock(block: PdfBlock): void {
    if (block.forceNewPage) {
      this.ctx.doc.addPage();
      this.currentY = this.ctx.usableTop;
    }

    const height = block.measure(this.ctx);

    // If the block fits, render in place
    if (this.currentY + height <= this.ctx.usableBottom) {
      this.currentY = block.render(this.ctx, this.currentY);
      this.currentY += BLOCK_SPACING;
      return;
    }

    // Block doesn't fit — if it can fit on a fresh page, move to new page
    if (height <= (this.ctx.usableBottom - this.ctx.usableTop)) {
      this.ctx.doc.addPage();
      this.currentY = this.ctx.usableTop;
      this.currentY = block.render(this.ctx, this.currentY);
      this.currentY += BLOCK_SPACING;
      return;
    }

    // Block is larger than a full page — render with internal pagination
    // (the block's render method should handle ensureSpace internally)
    this.currentY = block.render(this.ctx, this.currentY);
    this.currentY += BLOCK_SPACING;
  }

  /** Render an array of blocks sequentially */
  renderBlocks(blocks: PdfBlock[]): void {
    for (const block of blocks) {
      this.renderBlock(block);
    }
  }
}

// ══════════════════════════════════════════════════════
// BLOCK COMPONENTS
// ══════════════════════════════════════════════════════

// ── Section Title Block ──
class SectionTitleBlock implements PdfBlock {
  constructor(private title: string, public forceNewPage: boolean = false) {}

  measure(): number { return 14; }

  render(ctx: LayoutContext, y: number): number {
    const { doc, pageW, BC } = ctx;
    doc.setDrawColor(BC[0], BC[1], BC[2]);
    doc.setLineWidth(0.6);
    doc.line(ML, y - 2, pageW - MR, y - 2);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BC[0], BC[1], BC[2]);
    doc.text(sanitizeText(this.title), ML, y + 4);
    doc.setLineWidth(0.3);
    doc.line(ML, y + 7, pageW - MR, y + 7);
    return y + 12;
  }
}

// ── Sub-Section Title Block ──
class SubSectionTitleBlock implements PdfBlock {
  constructor(private title: string) {}
  measure(): number { return 12; }
  render(ctx: LayoutContext, y: number): number {
    ctx.doc.setFontSize(10);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.setTextColor(ctx.BC[0], ctx.BC[1], ctx.BC[2]);
    ctx.doc.text(this.title, ML, y);
    return y + 6;
  }
}

// ── Body Text Block ──
class BodyTextBlock implements PdfBlock {
  constructor(private text: string, private fontSize: number = 9, private italic: boolean = false, private indent: number = 0) {}

  measure(ctx: LayoutContext): number {
    return measureTextHeight(ctx.doc, this.text, ctx.contentW - this.indent, this.fontSize);
  }

  render(ctx: LayoutContext, y: number): number {
    const { doc, contentW } = ctx;
    doc.setFontSize(this.fontSize);
    doc.setFont("helvetica", this.italic ? "italic" : "normal");
    doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
    const lines = doc.splitTextToSize(sanitizeText(this.text), contentW - this.indent);
    doc.text(lines, ML + this.indent, y);
    return y + lines.length * 4.2 + 2;
  }
}

// ── Table Block (wraps autoTable with measurement) ──
class TableBlock implements PdfBlock {
  constructor(
    private head: string[][],
    private body: string[][],
    private options?: { columnStyles?: any; headColor?: RGB }
  ) {}

  measure(ctx: LayoutContext): number {
    const headerH = 8;
    const rowH = 7;
    return headerH + this.body.length * rowH + 4;
  }

  render(ctx: LayoutContext, y: number): number {
    const { doc, BC } = ctx;
    const headColor = this.options?.headColor || BC;
    autoTable(doc, {
      startY: y,
      head: this.head,
      body: this.body,
      theme: "grid",
      headStyles: { fillColor: [headColor[0], headColor[1], headColor[2]], font: "helvetica", fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      columnStyles: this.options?.columnStyles || {},
      margin: { left: ML, right: MR, top: ctx.usableTop },
    });
    return ((doc as any).lastAutoTable?.finalY || y + 20) + 2;
  }
}

// ── Plain Table Block (no header) ──
class PlainTableBlock implements PdfBlock {
  constructor(private data: [string, string][], private labelWidth: number = 50) {}

  measure(): number {
    return this.data.length * 7 + 4;
  }

  render(ctx: LayoutContext, y: number): number {
    const { doc, BC } = ctx;
    autoTable(doc, {
      startY: y,
      body: this.data.map(([l, v]) => [l, v]),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: this.labelWidth, textColor: [BC[0], BC[1], BC[2]] },
        1: { textColor: [DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]] },
      },
      margin: { left: ML, right: MR, top: ctx.usableTop },
    });
    return ((doc as any).lastAutoTable?.finalY || y + 20) + 2;
  }
}

// ── Activity Item Block — Professional timeline layout ──

const HORA_COL_W = 18; // fixed width for time column
const TIMELINE_DOT_R = 1.8;
const BADGE_FONT = 7.5;
const BADGE_PAD_H = 5;
const BADGE_PAD_V = 2;
const BADGE_H = 10;
const BADGE_GAP = 3;

// Badge color schemes: [bgR, bgG, bgB, textR, textG, textB]
const BADGE_COLORS: Record<string, [number, number, number, number, number, number]> = {
  tipo:           [220, 230, 245, 40, 70, 140],    // blue-gray
  concluida:      [220, 245, 220, 30, 110, 40],     // green
  em_andamento:   [235, 235, 238, 80, 80, 90],      // neutral gray
  impacto_leve:   [255, 248, 220, 150, 120, 20],    // warm yellow
  impacto_medio:  [255, 237, 213, 180, 100, 20],    // orange
  impacto_alto:   [255, 225, 225, 180, 40, 40],     // red
  impacto_critico:[255, 210, 210, 160, 20, 20],     // deep red
  // Occurrence-specific
  oc_tipo:        [225, 232, 248, 45, 75, 145],     // blue-gray for occurrence type
  oc_baixo:       [220, 245, 220, 30, 110, 40],     // green
  oc_medio:       [255, 237, 213, 180, 100, 20],    // orange
  oc_alto:        [255, 225, 225, 180, 40, 40],     // red
  oc_critico:     [255, 210, 210, 160, 20, 20],     // deep red
  oc_risco:       [255, 200, 200, 160, 30, 30],     // risk red
  oc_responsavel: [235, 235, 238, 80, 80, 90],      // neutral
  // Material-specific
  mat_tipo:       [225, 232, 248, 45, 75, 145],     // blue-gray
  mat_unidade:    [235, 235, 238, 80, 80, 90],      // neutral
  mat_fase:       [230, 240, 250, 50, 80, 140],     // light blue
  mat_custo:      [235, 245, 235, 40, 100, 50],     // green
  mat_alerta:     [255, 225, 225, 180, 40, 40],     // red
  mat_orcamento:  [220, 245, 220, 30, 110, 40],     // green
};

function getImpactoBadgeKey(impacto: string | null): string | null {
  if (!impacto || impacto === "nenhum") return null;
  const map: Record<string, string> = { leve: "impacto_leve", medio: "impacto_medio", alto: "impacto_alto", critico: "impacto_critico" };
  return map[impacto] || "impacto_leve";
}

function drawBadge(doc: jsPDF, text: string, x: number, y: number, colorKey: string): number {
  const colors = BADGE_COLORS[colorKey] || BADGE_COLORS.tipo;
  doc.setFontSize(BADGE_FONT);
  const tw = doc.getTextWidth(text);
  const bw = tw + BADGE_PAD_H * 2;
  const bh = BADGE_H;
  // Background
  doc.setFillColor(colors[0], colors[1], colors[2]);
  doc.roundedRect(x, y, bw, bh, 2, 2, "F");
  // Text
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors[3], colors[4], colors[5]);
  doc.text(text, x + BADGE_PAD_H, y + bh / 2 + 1.2);
  return bw;
}

class ActivityItemBlock implements PdfBlock {
  constructor(private a: any, private isLast: boolean = false) {}

  measure(ctx: LayoutContext): number {
    const descColW = ctx.contentW - HORA_COL_W - 8;
    ctx.doc.setFontSize(10);
    const descLines = ctx.doc.splitTextToSize(sanitizeText(this.a.descricao), descColW);
    const descH = descLines.length * 4.5;
    const badgeRowH = BADGE_H + 2;
    // block padding top(3) + desc + gap(2) + badges + padding bottom(3) + divider(3)
    return 3 + descH + 2 + badgeRowH + 3 + (this.isLast ? 0 : 3);
  }

  render(ctx: LayoutContext, y: number): number {
    const { doc, contentW } = ctx;
    const a = this.a;
    const descColW = contentW - HORA_COL_W - 8;
    const blockStartY = y;

    // Measure for background
    doc.setFontSize(10);
    const descLines = doc.splitTextToSize(sanitizeText(a.descricao), descColW);
    const descH = descLines.length * 4.5;
    const badgeRowH = BADGE_H + 2;
    const innerH = 3 + descH + 2 + badgeRowH + 3;

    // Subtle background
    doc.setFillColor(248, 249, 252);
    doc.roundedRect(ML, y, contentW, innerH, 1.5, 1.5, "F");

    y += 3; // top padding

    // ── Timeline dot ──
    const dotX = ML + 5;
    const dotY = y + 2;
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.circle(dotX, dotY, TIMELINE_DOT_R, "F");

    // ── Hora ──
    const horaX = ML + 10;
    if (a.hora) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.text(a.hora, horaX, y + 3);
    }

    // ── Description ──
    const descX = ML + HORA_COL_W + 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
    doc.text(descLines, descX, y + 3);
    y += descH + 2;

    // ── Badges row ──
    let bx = descX;
    const badgeY = y;

    // Type badge
    if (a.tipo_atividade) {
      const w = drawBadge(doc, sanitizeText(a.tipo_atividade), bx, badgeY, "tipo");
      bx += w + BADGE_GAP;
    }

    // Status badge
    if (a.concluida) {
      const w = drawBadge(doc, "Concluida", bx, badgeY, "concluida");
      bx += w + BADGE_GAP;
    } else {
      const w = drawBadge(doc, "Em andamento", bx, badgeY, "em_andamento");
      bx += w + BADGE_GAP;
    }

    // Impact badge
    const impKey = getImpactoBadgeKey(a.impacto_cronograma);
    if (impKey) {
      const label = `Impacto ${a.impacto_cronograma}`;
      drawBadge(doc, label, bx, badgeY, impKey);
    }

    y = blockStartY + innerH;

    // ── Divider ──
    if (!this.isLast) {
      doc.setDrawColor(217, 217, 217);
      doc.setLineWidth(0.3);
      doc.line(ML + 10, y + 1.5, ML + contentW - 10, y + 1.5);
      y += 3;
    }

    return y;
  }
}

// ── Occurrence Box Block (Timeline style with badges) ──
function getOcImpactoBadgeKey(impacto: string | null | undefined): string {
  const map: Record<string, string> = { baixo: "oc_baixo", "médio": "oc_medio", medio: "oc_medio", alto: "oc_alto", "crítico": "oc_critico", critico: "oc_critico" };
  return map[(impacto || "baixo").toLowerCase()] || "oc_baixo";
}

class OccurrenceBoxBlock implements PdfBlock {
  constructor(private o: any, private isLast: boolean = false) {}

  measure(ctx: LayoutContext): number {
    const descW = ctx.contentW - HORA_COL_W - 10;
    ctx.doc.setFontSize(10);
    const descLines = ctx.doc.splitTextToSize(sanitizeText(this.o.descricao), descW);
    const descH = descLines.length * 4.2;
    const badgeRowH = BADGE_H + 3;
    const dividerH = this.isLast ? 0 : 4;
    return Math.max(descH + badgeRowH + 6, 18) + dividerH;
  }

  render(ctx: LayoutContext, y: number): number {
    const { doc, contentW } = ctx;
    const o = this.o;
    const descX = ML + HORA_COL_W + 8;
    const descW = contentW - HORA_COL_W - 10;

    // Measure
    doc.setFontSize(10);
    const descLines = doc.splitTextToSize(sanitizeText(o.descricao), descW);
    const descH = descLines.length * 4.2;
    const badgeRowH = BADGE_H + 3;
    const blockH = Math.max(descH + badgeRowH + 6, 18);

    // Background
    doc.setFillColor(248, 245, 240);
    doc.roundedRect(ML, y, contentW, blockH, 1.5, 1.5, "F");

    // Timeline dot (orange/warning)
    doc.setFillColor(220, 160, 40);
    doc.circle(ML + 4, y + 5.5, TIMELINE_DOT_R, "F");

    // Icon marker
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 130, 20);
    doc.text("[!]", ML + 8, y + 6.5);

    // Description
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
    doc.text(descLines, descX, y + 5.5);

    // Badges row
    const badgeY = y + descH + 4;
    let bx = descX;

    // Type badge
    if (o.tipo_ocorrencia) {
      const w = drawBadge(doc, sanitizeText(o.tipo_ocorrencia), bx, badgeY, "oc_tipo");
      bx += w + BADGE_GAP;
    }

    // Impact badge
    const impKey = getOcImpactoBadgeKey(o.impacto);
    const impLabel = `Impacto ${(o.impacto || "baixo")}`;
    const w2 = drawBadge(doc, impLabel, bx, badgeY, impKey);
    bx += w2 + BADGE_GAP;

    // Contractual risk badge
    if (o.gera_risco_contratual) {
      const w3 = drawBadge(doc, "Risco contratual", bx, badgeY, "oc_risco");
      bx += w3 + BADGE_GAP;
    }

    // Responsible badge
    if (o.responsavel) {
      drawBadge(doc, sanitizeText(o.responsavel), bx, badgeY, "oc_responsavel");
    }

    // Divider
    if (!this.isLast) {
      const divY = y + blockH + 2;
      doc.setDrawColor(217, 217, 217);
      doc.setLineWidth(0.3);
      doc.line(ML + 4, divY, ML + contentW - 4, divY);
    }

    return y + blockH + (this.isLast ? 4 : 6);
  }
}

// ── Photo Grid Block (2 photos per row) ──

interface PhotoEntry {
  foto: any;
  figureNum: number;
  imgBase64: string | null;
  faseObra: string | null;
}

class PhotoGridBlock implements PdfBlock {
  private colW: number;
  private imgW: number;
  private imgH: number;
  private gap = 6;

  constructor(
    private left: PhotoEntry,
    private right: PhotoEntry | null,
    contentW: number
  ) {
    this.colW = (contentW - this.gap) / 2;
    this.imgW = this.colW;
    this.imgH = this.colW * 0.75;
  }

  measure(ctx: LayoutContext): number {
    const leftH = this.imgH + 4 + this.measureCaption(ctx, this.left) + 6;
    const rightH = this.right
      ? this.imgH + 4 + this.measureCaption(ctx, this.right) + 6
      : 0;
    return Math.max(leftH, rightH);
  }

  private measureCaption(ctx: LayoutContext, entry: PhotoEntry): number {
    const { doc } = ctx;
    const caption = buildPhotoCaption(entry.foto, entry.faseObra);
    doc.setFontSize(8);
    const figTitle = `Figura ${String(entry.figureNum).padStart(2, "0")} - ${sanitizeText(caption.substring(0, 80))}`;
    const figLines = doc.splitTextToSize(figTitle, this.imgW);
    let h = figLines.length * 3.5 + 1;
    if (entry.foto.data_captura) h += 3.5;
    if (entry.foto.latitude && entry.foto.longitude) h += 3.5;
    if (entry.foto.fase_obra) h += 3.5;
    if (entry.foto.tag_risco && entry.foto.tag_risco !== "nenhuma") h += 3.5;
    doc.setFontSize(7);
    const techLines = doc.splitTextToSize(`Descricao tecnica: ${sanitizeText(caption)}`, this.imgW);
    h += techLines.length * 3.2 + 2;
    return h;
  }

  render(ctx: LayoutContext, y: number): number {
    const totalH = this.measure(ctx);
    this.renderSingle(ctx, y, ML, this.left);
    if (this.right) {
      this.renderSingle(ctx, y, ML + this.colW + this.gap, this.right);
    }
    return y + totalH;
  }

  private renderSingle(ctx: LayoutContext, y: number, x: number, entry: PhotoEntry): void {
    const { doc } = ctx;
    let cy = y;

    if (entry.imgBase64) {
      try {
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.rect(x - 1, cy - 1, this.imgW + 2, this.imgH + 2);
        doc.addImage(entry.imgBase64, "JPEG", x, cy, this.imgW, this.imgH);
      } catch { /* skip */ }
    }
    cy += this.imgH + 4;

    const caption = buildPhotoCaption(entry.foto, entry.faseObra);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
    const figTitle = `Figura ${String(entry.figureNum).padStart(2, "0")} - ${sanitizeText(caption.substring(0, 80))}`;
    const figLines = doc.splitTextToSize(figTitle, this.imgW);
    doc.text(figLines, x, cy);
    cy += figLines.length * 3.5 + 1;

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
    if (entry.foto.data_captura) {
      doc.text(`Data da captura: ${fmtDateTime(entry.foto.data_captura)}`, x, cy);
      cy += 3.5;
    }
    if (entry.foto.latitude && entry.foto.longitude) {
      doc.text(`Local (GPS): ${entry.foto.latitude.toFixed(5)}, ${entry.foto.longitude.toFixed(5)}`, x, cy);
      cy += 3.5;
    }
    if (entry.foto.fase_obra) {
      doc.text(`Fase da obra: ${entry.foto.fase_obra}`, x, cy);
      cy += 3.5;
    }
    if (entry.foto.tag_risco && entry.foto.tag_risco !== "nenhuma") {
      doc.setTextColor(239, 68, 68);
      doc.text(`Risco: ${entry.foto.tag_risco.toUpperCase()}`, x, cy);
      cy += 3.5;
      doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
    }

    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(80, 80, 80);
    const techLines = doc.splitTextToSize(`Descricao tecnica: ${sanitizeText(caption)}`, this.imgW);
    doc.text(techLines, x, cy);
  }
}

// ── Expenses Table Block (subtotal included) ──
class ExpensesTableBlock implements PdfBlock {
  private tipoLabels: Record<string, string> = { material: "Material", mao_de_obra: "Mao de Obra", equipamento: "Equipamento", transporte: "Transporte", outro: "Outro" };
  constructor(private despesas: any[]) {}

  measure(): number {
    return 8 + this.despesas.length * 7 + 12; // header + rows + subtotal
  }

  render(ctx: LayoutContext, y: number): number {
    const { doc, BC } = ctx;
    autoTable(doc, {
      startY: y,
      head: [["Descricao", "Tipo", "Qtd", "Unid.", "V. Unit.", "V. Total"]],
      body: this.despesas.map((d: any) => [
        sanitizeText(d.descricao.substring(0, 50)),
        this.tipoLabels[d.tipo] || d.tipo,
        String(d.quantidade || 0),
        d.unidade || "un",
        `R$ ${Number(d.valor_unitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        `R$ ${Number(d.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      ]),
      theme: "grid",
      headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
      styles: { fontSize: 7, cellPadding: 2 },
      margin: { left: ML, right: MR, top: ctx.usableTop },
    });
    y = ((doc as any).lastAutoTable?.finalY || y + 20) + 2;

    const subtotal = this.despesas.reduce((s: number, d: any) => s + Number(d.valor_total || 0), 0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
    doc.text(`Subtotal do dia: R$ ${subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, ML, y + 2);
    return y + 8;
  }
}

// ── Spacer Block ──
class SpacerBlock implements PdfBlock {
  constructor(private height: number) {}
  measure(): number { return this.height; }
  render(_ctx: LayoutContext, y: number): number { return y + this.height; }
}

// ── Chart helpers (standalone functions used within indicator blocks) ──
function drawBarChart(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  data: { label: string; value: number; color: RGB }[],
  title: string, unit: string, BC: RGB
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
  value: number, label: string, BC: RGB
) {
  const r = radius;
  doc.setFillColor(230, 230, 230);
  doc.circle(cx, cy, r, "F");
  const clampedVal = Math.min(100, Math.max(0, value));
  const color: RGB = clampedVal >= 70 ? [34, 197, 94] : clampedVal >= 50 ? [234, 179, 8] : [239, 68, 68];
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

// ── Institutional Header/Footer/Watermark (applied post-render) ──
function addLogoWatermark(doc: jsPDF, logoBase64: string | null) {
  if (!logoBase64) return;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
  const wmW = pageW * 0.6;
  const wmH = wmW * 0.5;
  try { doc.addImage(logoBase64, "PNG", (pageW - wmW) / 2, (pageH - wmH) / 2, wmW, wmH); } catch {}
  doc.restoreGraphicsState();
}

function addInstitutionalHeader(
  doc: jsPDF, projectName: string, companyName?: string,
  technicalResponsible?: string, logoBase64?: string | null, BC: RGB = BLUE_TECH
) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(BC[0], BC[1], BC[2]);
  doc.rect(0, 0, pageW, 2.5, "F");
  let hx = ML;
  if (logoBase64) { try { doc.addImage(logoBase64, "PNG", hx, 4, 12, 6); hx += 14; } catch {} }
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BC[0], BC[1], BC[2]);
  doc.text("RELATORIO TECNICO DE ACOMPANHAMENTO DE OBRA", hx, 8);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text(sanitizeText(`Obra: ${projectName}`), hx, 12);
  const rightX = pageW - MR;
  if (technicalResponsible) { doc.setFontSize(6); doc.text(sanitizeText(`Resp. Tecnico: ${technicalResponsible}`), rightX, 8, { align: "right" }); }
  if (companyName) { doc.text(sanitizeText(companyName), rightX, 12, { align: "right" }); }
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
  if (generatedAt) doc.text(`Data de geracao: ${generatedAt}`, ML, fy + 8);
  doc.text(`Pagina ${pageNum} de ${totalPages}`, pageW - MR, fy + 4, { align: "right" });
  if (companyName) doc.text(sanitizeText(companyName), pageW - MR, fy + 8, { align: "right" });
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

  const BC: RGB = brandColor ? hexToRgb(brandColor) : BLUE_TECH;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const now = new Date();
  const generatedAt = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const reportId = `RTAO-${format(now, "yyyyMMddHHmmss")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - ML - MR;
  const usableBottom = pageH - MB;

  const ctx: LayoutContext = { doc, pageW, pageH, contentW, usableTop: USABLE_TOP, usableBottom, BC };

  const creaCau = await fetchCompanyCreaCau(companyId);

  onProgress?.("Calculando hash de integridade...");
  const integrityHash = await computeHash(JSON.stringify({ reportId, projectName, generated: now.toISOString(), count: rdos.length, ids: rdos.map((r) => r.id) }));
  const shortHash = integrityHash.substring(0, 16).toUpperCase();
  onProgress?.("Gerando QR Code...");
  const qrDataUrl = await generateQR(JSON.stringify({ id: reportId, hash: shortHash, project: projectName, entries: rdos.length, generated: now.toISOString() }));

  const sorted = [...rdos].sort((a, b) => a.data.localeCompare(b.data));
  const period = sorted.length > 0 ? `${fmtDateShort(sorted[0].data)} a ${fmtDateShort(sorted[sorted.length - 1].data)}` : "—";

  let secNum = 0;
  function nextSec(): number { return ++secNum; }

  const bookmarks: { title: string; page: number; children?: { title: string; page: number }[] }[] = [];
  function trackSection(title: string) { bookmarks.push({ title, page: doc.getNumberOfPages() }); }

  // Pre-fetch all sub-data
  onProgress?.("Carregando dados detalhados...");
  const allAtividades: Record<string, any[]> = {};
  const allOcorrencias: Record<string, any[]> = {};
  const allMateriais: Record<string, any[]> = {};
  const allDespesas: Record<string, any[]> = {};
  const allFotos: Record<string, any[]> = {};
  const allFotoImages: Record<string, (string | null)[]> = {};

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

  // Pre-load all photo images
  if (includePhotos) {
    onProgress?.("Carregando imagens...");
    for (const rdo of sorted) {
      const fotos = allFotos[rdo.id] || [];
      const images = await Promise.all(fotos.map((f: any) => loadImageAsBase64(f.url)));
      allFotoImages[rdo.id] = images;
    }
  }

  // ══════════════════════════════════════════
  // 1. CAPA INSTITUCIONAL
  // ══════════════════════════════════════════
  onProgress?.("Gerando capa institucional...");

  const coverCenterX = pageW / 2;
  const coverMaxW = Math.min(140, contentW);
  const coverLeft = (pageW - coverMaxW) / 2;
  const coverRight = coverLeft + coverMaxW;

  doc.setFillColor(BC[0], BC[1], BC[2]);
  doc.rect(0, 0, pageW, 3, "F");

  let coverY = 40;
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
  });

  const tableEndY = (doc as any).lastAutoTable?.finalY || coverY + 60;
  const qrY = Math.max(coverY + 5, tableEndY - 35);
  doc.addImage(qrDataUrl, "PNG", coverRight - 30, qrY - 10, 28, 28);
  doc.setFontSize(6);
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text("Autenticidade", coverRight - 16, qrY + 20, { align: "center" });

  if (includeSideStamp) {
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BC[0], BC[1], BC[2]);
    const stampLines = [
      "RELATORIO TECNICO", "DOCUMENTO OFICIAL",
      `RDO ${sorted.length > 0 ? `No ${String(sorted.length).padStart(3, "0")}/${format(now, "yyyy")}` : ""}`,
    ];
    stampLines.forEach((line, i) => doc.text(line, 8, pageH / 2 - 10 + i * 5, { angle: 90 }));
    doc.restoreGraphicsState();
  }

  const sigBlockY = Math.max(tableEndY + 14, pageH - 80);
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
  if (technicalResponsible) doc.text(sanitizeText(technicalResponsible), coverCenterX, sigBlockY + 11, { align: "center" });
  doc.text(`CREA / CAU: ${creaCau || "_______________"}`, coverCenterX, sigBlockY + 16, { align: "center" });

  doc.setFillColor(BC[0], BC[1], BC[2]);
  doc.rect(0, pageH - 16, pageW, 16, "F");
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`Hash de Integridade (SHA-256): ${shortHash}`, coverCenterX, pageH - 9, { align: "center" });
  doc.text("Documento gerado automaticamente pelo ERP Canteiro Inteli", coverCenterX, pageH - 4, { align: "center" });

  // ══════════════════════════════════════════
  // SUMARIO — Reserve pages upfront
  // ══════════════════════════════════════════
  // Calculate how many TOC pages we need based on known section count
  const fixedSections = 9; // IDENTIFICACAO, OBJETIVO, METODOLOGIA, daily blocks header, INDICADORES, ANALISE, CONCLUSAO, RECOMENDACOES, ASSINATURA, VERIFICACAO
  const totalTocEntries = fixedSections + sorted.length;
  const tocEntryH = 7;
  const tocTitleH = 14;
  const tocUsableH = usableBottom - USABLE_TOP;
  const firstPageEntries = Math.floor((tocUsableH - tocTitleH) / tocEntryH);
  const remainingEntries = Math.max(0, totalTocEntries - firstPageEntries);
  const entriesPerExtraPage = Math.floor(tocUsableH / tocEntryH);
  const extraTocPages = remainingEntries > 0 ? Math.ceil(remainingEntries / entriesPerExtraPage) : 0;
  const totalTocPages = 1 + extraTocPages;

  // Reserve all TOC pages in sequence after the cover
  const tocFirstPage = doc.getNumberOfPages() + 1;
  for (let tp = 0; tp < totalTocPages; tp++) {
    doc.addPage();
  }
  trackSection("SUMARIO");

  // ══════════════════════════════════════════
  // INSTITUTIONAL SECTIONS via Layout Engine
  // ══════════════════════════════════════════
  const engine = new VerticalLayoutEngine(ctx);

  // ── IDENTIFICACAO ──
  onProgress?.("Gerando identificacao...");
  doc.addPage();
  engine.setY(USABLE_TOP);
  const secIdentTitle = `${nextSec()}. IDENTIFICACAO DO RELATORIO`;
  trackSection(secIdentTitle);
  engine.renderBlock(new SectionTitleBlock(secIdentTitle));
  engine.renderBlock(new TableBlock(
    [["Item", "Informacao"]],
    [
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
    { columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } } }
  ));

  // ── OBJETIVO ──
  doc.addPage();
  engine.setY(USABLE_TOP);
  const secObjTitle = `${nextSec()}. OBJETIVO`;
  trackSection(secObjTitle);
  engine.renderBlock(new SectionTitleBlock(secObjTitle));
  engine.renderBlock(new BodyTextBlock(
    "O presente relatorio tecnico tem por finalidade registrar as atividades executadas na obra, " +
    "bem como documentar ocorrencias relevantes, condicoes de execucao e evidencias fotograficas " +
    "referentes ao periodo do registro. Este documento e parte integrante do Diario de Obra e " +
    "possui carater tecnico e documental, sendo adequado para fins de fiscalizacao, auditoria " +
    "e processos administrativos."
  ));

  // ── METODOLOGIA ──
  engine.renderBlock(new SpacerBlock(6));
  const secMetTitle = `${nextSec()}. METODOLOGIA`;
  engine.ensureSpace(40);
  if (engine.getY() <= USABLE_TOP + 6) trackSection(secMetTitle);
  engine.renderBlock(new SectionTitleBlock(secMetTitle));
  engine.renderBlock(new BodyTextBlock(
    "As informacoes contidas neste relatorio foram obtidas por meio de acompanhamento tecnico " +
    "da obra, registros fotograficos georreferenciados, observacoes de campo, comunicacao com " +
    "a equipe executora e dados inseridos no sistema de gestao de obras (ERP). " +
    "Os registros fotograficos foram obtidos in loco e possuem metadados de data/hora e, quando " +
    "disponivel, coordenadas GPS. Os dados quantitativos de produtividade, custo e avanco fisico " +
    "foram registrados diariamente pelo responsavel tecnico da obra."
  ));

  // ══════════════════════════════════════════
  // DAILY BLOCKS
  // ══════════════════════════════════════════
  let figureNum = 1;
  let totalGeralDespesas = 0;

  for (let dayIdx = 0; dayIdx < sorted.length; dayIdx++) {
    const rdo = sorted[dayIdx];
    const atividades = allAtividades[rdo.id] || [];
    const ocorrencias = allOcorrencias[rdo.id] || [];
    const despesas = includeDespesas ? (allDespesas[rdo.id] || []).filter((d: any) => d.incluir_no_pdf) : [];
    const fotos = allFotos[rdo.id] || [];
    const fotoImages = allFotoImages[rdo.id] || [];

    const rdoNumLabel = rdo.numero_sequencial ? `RDO ${String(rdo.numero_sequencial).padStart(3, "0")}` : `RDO ${String(dayIdx + 1).padStart(3, "0")}`;
    const dayTitle = `${rdoNumLabel} - ${fmtDate(rdo.data)} - ${rdo.fase_obra || "Fase nao informada"}`;
    const daySectionTitle = `${nextSec()}. ${dayTitle}`;

    onProgress?.(`Gerando bloco diario ${dayIdx + 1}/${sorted.length}...`);

    // Force new page for each day
    doc.addPage();
    engine.setY(USABLE_TOP);
    trackSection(daySectionTitle);

    // Day header
    engine.renderBlock(new SectionTitleBlock(daySectionTitle));

    // Day summary table
    const summaryData: [string, string][] = [
      ["Clima", rdo.clima || "Nao informado"],
      ["Equipe Total", `${rdo.equipe_total} pessoa(s)`],
      ["Horas Trabalhadas", `${rdo.horas_trabalhadas || 0}h`],
      ["Risco do Dia", (rdo.risco_dia || "baixo").toUpperCase()],
      ["Custo do Dia", rdo.custo_dia ? `R$ ${Number(rdo.custo_dia).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Nao informado"],
      ["Produtividade", rdo.produtividade_percentual ? `${rdo.produtividade_percentual}%` : "Nao informado"],
      ["Avanco Fisico do Dia", rdo.percentual_fisico_dia ? `${rdo.percentual_fisico_dia}%` : "Nao informado"],
      ["Avanco Fisico Acumulado", rdo.percentual_fisico_acumulado ? `${rdo.percentual_fisico_acumulado}%` : "Nao informado"],
    ];
    engine.renderBlock(new PlainTableBlock(summaryData));

    // 1. Activities
    if (includeActivities) {
      engine.ensureSpace(20);
      engine.renderBlock(new SubSectionTitleBlock("1. ATIVIDADES EXECUTADAS"));
      if (atividades.length > 0) {
        const sortedAtiv = [...atividades].sort((a: any, b: any) => (a.hora || "99:99").localeCompare(b.hora || "99:99"));
        for (let ai = 0; ai < sortedAtiv.length; ai++) {
          const block = new ActivityItemBlock(sortedAtiv[ai], ai === sortedAtiv.length - 1);
          engine.renderBlock(block);
        }
      } else {
        engine.renderBlock(new BodyTextBlock("Nenhuma atividade registrada neste dia."));
      }
    }

    // 2. Occurrences
    if (includeOccurrences && ocorrencias.length > 0) {
      engine.renderBlock(new SpacerBlock(4));
      engine.ensureSpace(20);
      engine.renderBlock(new SubSectionTitleBlock("2. OCORRENCIAS E FATOS RELEVANTES"));
      for (let oi = 0; oi < ocorrencias.length; oi++) {
        engine.renderBlock(new OccurrenceBoxBlock(ocorrencias[oi], oi === ocorrencias.length - 1));
      }
    }

    // 3. Expenses
    if (includeDespesas && despesas.length > 0) {
      engine.renderBlock(new SpacerBlock(4));
      engine.ensureSpace(20);
      engine.renderBlock(new SubSectionTitleBlock("3. DESPESAS DO DIA"));
      const expBlock = new ExpensesTableBlock(despesas);
      engine.renderBlock(expBlock);
      totalGeralDespesas += despesas.reduce((s: number, d: any) => s + Number(d.valor_total || 0), 0);
    }

    // 4. Photos
    if (includePhotos && fotos.length > 0) {
      engine.renderBlock(new SpacerBlock(4));
      engine.ensureSpace(20);
      engine.renderBlock(new SubSectionTitleBlock("4. REGISTRO FOTOGRAFICO COMENTADO"));
      // Render photos in grid of 2 per row
      for (let fi = 0; fi < fotos.length; fi += 2) {
        const leftEntry: PhotoEntry = {
          foto: fotos[fi],
          figureNum,
          imgBase64: fotoImages[fi] || null,
          faseObra: rdo.fase_obra,
        };
        figureNum++;
        const rightEntry: PhotoEntry | null = fi + 1 < fotos.length
          ? { foto: fotos[fi + 1], figureNum, imgBase64: fotoImages[fi + 1] || null, faseObra: rdo.fase_obra }
          : null;
        if (rightEntry) figureNum++;
        engine.renderBlock(new PhotoGridBlock(leftEntry, rightEntry, contentW));
      }
    }

    // 5. Technical Synthesis
    engine.renderBlock(new SpacerBlock(4));
    engine.ensureSpace(30);
    engine.renderBlock(new SubSectionTitleBlock("5. SINTESE TECNICA DO DIA"));

    const synthParts: string[] = [];
    synthParts.push(`No dia ${fmtDate(rdo.data)}`);
    synthParts.push(atividades.length > 0 ? `foram registradas ${atividades.length} atividade(s) executada(s)` : `nao foram registradas atividades`);
    if (rdo.fase_obra) synthParts.push(`na fase de ${rdo.fase_obra}`);
    synthParts.push(`com equipe de ${rdo.equipe_total} pessoa(s) e ${rdo.horas_trabalhadas || 0}h trabalhadas`);
    if (ocorrencias.length > 0) synthParts.push(`${ocorrencias.length} ocorrencia(s) relevante(s) registrada(s)`);
    if (despesas.length > 0) {
      const sub = despesas.reduce((s: number, d: any) => s + Number(d.valor_total || 0), 0);
      synthParts.push(`despesas totalizando R$ ${sub.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    }
    if (fotos.length > 0) synthParts.push(`${fotos.length} registro(s) fotografico(s) anexado(s)`);
    synthParts.push(`classificacao de risco: ${(rdo.risco_dia || "baixo").toLowerCase()}`);
    engine.renderBlock(new BodyTextBlock(synthParts.join(", ") + "."));

    if (rdo.observacoes_gerais) {
      engine.renderBlock(new BodyTextBlock(`Observacoes: ${rdo.observacoes_gerais}`, 8, true, 3));
    }
  }

  // ══════════════════════════════════════════
  // INDICADORES TECNICOS
  // ══════════════════════════════════════════
  onProgress?.("Gerando indicadores tecnicos...");
  doc.addPage();
  engine.setY(USABLE_TOP);
  const secIndicTitle = `${nextSec()}. INDICADORES TECNICOS`;
  trackSection(secIndicTitle);
  engine.renderBlock(new SectionTitleBlock(secIndicTitle));

  const totalCost = sorted.reduce((s, r) => s + Number(r.custo_dia || 0), 0);
  const avgTeam = sorted.length > 0 ? Math.round(sorted.reduce((s, r) => s + r.equipe_total, 0) / sorted.length) : 0;
  const avgProd = sorted.length > 0 ? Math.round(sorted.reduce((s, r) => s + Number(r.produtividade_percentual || 0), 0) / sorted.length) : 0;
  const maxPhysical = sorted.length > 0 ? Math.max(...sorted.map((r) => Number(r.percentual_fisico_acumulado || 0))) : 0;
  const totalHours = sorted.reduce((s, r) => s + Number(r.horas_trabalhadas || 0), 0);
  const riskCount: Record<string, number> = {};
  sorted.forEach((r) => { riskCount[r.risco_dia || "baixo"] = (riskCount[r.risco_dia || "baixo"] || 0) + 1; });
  const allIndicatorsZero = avgProd === 0 && maxPhysical === 0 && totalCost === 0;

  engine.renderBlock(new TableBlock(
    [["Indicador", "Valor"]],
    [
      ["Total de registros RDO", String(sorted.length)],
      ["Periodo analisado", period],
      ["Custo total acumulado", totalCost > 0 ? `R$ ${totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Nao informado"],
      ["Media de equipe/dia", avgTeam > 0 ? `${avgTeam} pessoas` : "Nao informado"],
      ["Total de horas trabalhadas", totalHours > 0 ? `${totalHours}h` : "Nao informado"],
      ["Produtividade media", avgProd > 0 ? `${avgProd}%` : "Nao informado"],
      ["Avanco fisico acumulado", maxPhysical > 0 ? `${maxPhysical}%` : "Nao informado"],
      ...Object.entries(riskCount).map(([r, c]) => [`Dias com risco ${r}`, `${c} dia(s)`]),
    ],
    { columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } } }
  ));

  if (allIndicatorsZero) {
    engine.renderBlock(new BodyTextBlock(
      "Nota: Os indicadores acima apresentam valores nao informados pois os campos de produtividade, " +
      "avanco fisico e custo diario nao foram preenchidos nos registros do periodo. " +
      "Para obter indicadores completos, preencha esses campos ao registrar cada RDO.", 8, true
    ));
  }

  // Visual gauges
  if (!allIndicatorsZero) {
    let y = engine.getY();
    y = engine.ensureSpace(50);
    const gaugeY = y + 20;
    const gaugeSpacing = contentW / 3;
    drawGauge(doc, ML + gaugeSpacing * 0.5, gaugeY, 14, avgProd, "Produtividade", BC);
    drawGauge(doc, ML + gaugeSpacing * 1.5, gaugeY, 14, maxPhysical, "Avanco Fisico", BC);
    const costPct = totalCost > 0 ? Math.min(100, Math.round((totalCost / Math.max(totalCost * 1.2, 1)) * 100)) : 0;
    drawGauge(doc, ML + gaugeSpacing * 2.5, gaugeY, 14, costPct, "Custo Exec.", BC);
    engine.setY(gaugeY + 30);

    if (sorted.length > 1 && sorted.length <= 15) {
      engine.ensureSpace(50);
      let barY = engine.getY();
      const barData = sorted.map((r) => ({ label: fmtDateShort(r.data), value: r.equipe_total, color: ACCENT as RGB }));
      drawBarChart(doc, ML, barY, contentW, 35, barData, "Equipe por Dia", "", BC);
      engine.setY(barY + 45);
    }
  }

  // ══════════════════════════════════════════
  // ANALISE TECNICA
  // ══════════════════════════════════════════
  onProgress?.("Gerando analise tecnica...");
  doc.addPage();
  engine.setY(USABLE_TOP);
  const secAnaliseTitle = `${nextSec()}. ANALISE TECNICA`;
  trackSection(secAnaliseTitle);
  engine.renderBlock(new SectionTitleBlock(secAnaliseTitle));

  const hasHighRisk = (riskCount["alto"] || 0) > 0;
  const hasMedRisk = (riskCount["medio"] || 0) > 0;
  const allOcorrenciasList = sorted.flatMap((r) => allOcorrencias[r.id] || []);
  const hasContractualRisk = allOcorrenciasList.some((o: any) => o.gera_risco_contratual);

  let analysisText = `As atividades executadas durante o periodo de ${period} encontram-se registradas de forma detalhada nos itens anteriores deste relatorio. `;
  if (allIndicatorsZero) {
    analysisText += "Os indicadores quantitativos de produtividade e avanco fisico nao foram preenchidos nos registros do periodo, impossibilitando uma analise comparativa detalhada. Recomenda-se o preenchimento desses campos nos proximos registros. ";
  } else if (avgProd >= 70) {
    analysisText += `A produtividade media de ${avgProd}% indica desempenho satisfatorio da equipe executora. `;
  } else if (avgProd >= 50) {
    analysisText += `A produtividade media de ${avgProd}% indica desempenho moderado, sendo recomendavel atencao para eventuais melhorias no processo executivo. `;
  } else {
    analysisText += `A produtividade media de ${avgProd}% indica desempenho abaixo do esperado, requerendo analise das causas e implementacao de acoes corretivas. `;
  }
  if (hasHighRisk) analysisText += `Foram identificados ${riskCount["alto"]} dia(s) com classificacao de risco alto, demandando atencao imediata da gestao tecnica. `;
  if (hasContractualRisk) analysisText += `ATENCAO: Foram identificadas ocorrencias com potencial risco contratual, conforme detalhado na secao de ocorrencias. `;
  engine.renderBlock(new BodyTextBlock(analysisText));

  if (aiSummary) {
    engine.ensureSpace(20);
    engine.renderBlock(new SubSectionTitleBlock("Analise Inteligente (IA)"));
    engine.renderBlock(new BodyTextBlock(sanitizeText(aiSummary)));
  }

  // ══════════════════════════════════════════
  // CONCLUSAO TECNICA
  // ══════════════════════════════════════════
  doc.addPage();
  engine.setY(USABLE_TOP);
  const secConcTitle = `${nextSec()}. CONCLUSAO TECNICA`;
  trackSection(secConcTitle);
  engine.renderBlock(new SectionTitleBlock(secConcTitle));

  const fases = [...new Set(sorted.map((r) => r.fase_obra).filter(Boolean))];
  const faseText = fases.length > 0 ? fases.join(", ") : "etapa atual";
  let conclusionText = `Com base nas observacoes realizadas durante o periodo analisado (${period}), conclui-se que as atividades registradas correspondem a(s) etapa(s) de ${faseText} prevista(s) para a fase atual da obra. `;
  if (!allIndicatorsZero) {
    conclusionText += `O avanco fisico acumulado atingiu ${maxPhysical}%, com custo total de R$ ${totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. A equipe media foi de ${avgTeam} pessoa(s) com ${totalHours} horas totais trabalhadas no periodo.`;
  } else {
    conclusionText += `A equipe media foi de ${avgTeam} pessoa(s) com ${totalHours} horas totais trabalhadas no periodo. Os demais indicadores quantitativos nao foram preenchidos.`;
  }
  engine.renderBlock(new BodyTextBlock(conclusionText));

  if (hasHighRisk || hasMedRisk) {
    engine.renderBlock(new BodyTextBlock(
      "Ressalta-se que durante o periodo foram registrados dias com classificacao de risco " +
      (hasHighRisk ? "alto" : "medio") + ", conforme detalhado na secao de indicadores tecnicos, " +
      "requerendo monitoramento continuo pela equipe de gestao."
    ));
  }

  // ══════════════════════════════════════════
  // RECOMENDACOES
  // ══════════════════════════════════════════
  engine.ensureSpace(40);
  const secRecomTitle = `${nextSec()}. RECOMENDACOES`;
  if (engine.getY() <= USABLE_TOP + 6) trackSection(secRecomTitle);
  engine.renderBlock(new SectionTitleBlock(secRecomTitle));

  const recommendations: string[] = [];
  if (allIndicatorsZero) recommendations.push("Preencher os campos de produtividade, avanco fisico e custo diario nos proximos registros de RDO para permitir analise quantitativa completa.");
  if (avgProd > 0 && avgProd < 70) recommendations.push("Avaliar causas da produtividade abaixo da meta e implementar acoes corretivas para melhoria do desempenho executivo.");
  if (hasHighRisk) recommendations.push("Intensificar o monitoramento de seguranca nos dias com classificacao de risco alto, garantindo a implementacao de medidas preventivas.");
  if (hasContractualRisk) recommendations.push("Documentar e formalizar as ocorrencias com risco contratual junto a contratante para fins de resguardo tecnico e juridico.");
  if (allOcorrenciasList.length > 0) recommendations.push("Manter o registro sistematico de ocorrencias para garantir rastreabilidade e possibilitar analises futuras de tendencias.");
  if (recommendations.length === 0) {
    recommendations.push("Manter o ritmo de execucao observado e a qualidade dos registros tecnicos diarios.");
    recommendations.push("Continuar o acompanhamento fotografico detalhado para fins de documentacao e auditoria.");
  }
  for (const rec of recommendations) {
    engine.renderBlock(new BodyTextBlock(`- ${rec}`, 9, false, 3));
  }

  // ══════════════════════════════════════════
  // ASSINATURA TECNICA
  // ══════════════════════════════════════════
  doc.addPage();
  engine.setY(USABLE_TOP);
  const secAssinaTitle = `${nextSec()}. ASSINATURA TECNICA`;
  trackSection(secAssinaTitle);
  engine.renderBlock(new SectionTitleBlock(secAssinaTitle));

  let sigY = engine.getY() + 30;
  const sigX = pageW / 2;
  doc.setDrawColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.setLineWidth(0.4);
  doc.line(sigX - 50, sigY, sigX + 50, sigY);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.text("Responsavel Tecnico", sigX, sigY + 6, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (technicalResponsible) doc.text(sanitizeText(technicalResponsible), sigX, sigY + 12, { align: "center" });
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text(`CREA / CAU: ${creaCau || "_______________"}`, sigX, sigY + 18, { align: "center" });
  sigY += 40;
  doc.setFontSize(9);
  doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);
  doc.text(`Data: ${format(now, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, sigX, sigY, { align: "center" });

  // ══════════════════════════════════════════
  // INFORMACOES DE VERIFICACAO
  // ══════════════════════════════════════════
  doc.addPage();
  engine.setY(USABLE_TOP);
  const secVerifTitle = `${nextSec()}. INFORMACOES DE VERIFICACAO`;
  trackSection(secVerifTitle);
  engine.renderBlock(new SectionTitleBlock(secVerifTitle));

  let verY = engine.getY();
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
  verifyInfo.forEach((line, i) => doc.text(line, ML, verY + i * 7));
  verY += verifyInfo.length * 7 + 10;
  doc.addImage(qrDataUrl, "PNG", ML, verY, 40, 40);
  doc.setFontSize(8);
  doc.setTextColor(GRAY_TEXT[0], GRAY_TEXT[1], GRAY_TEXT[2]);
  doc.text("Escaneie o QR Code para verificar a autenticidade deste relatorio.", ML, verY + 46);

  // ══════════════════════════════════════════
  // TOC — Fill reserved pages
  // ══════════════════════════════════════════
  onProgress?.("Finalizando sumario...");
  const tocEntries = bookmarks.filter((b) => b.title !== "SUMARIO");

  let currentTocPage = tocFirstPage;
  doc.setPage(currentTocPage);
  let tocY = USABLE_TOP;

  // Render TOC title on first TOC page
  doc.setDrawColor(BC[0], BC[1], BC[2]);
  doc.setLineWidth(0.6);
  doc.line(ML, tocY - 2, pageW - MR, tocY - 2);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BC[0], BC[1], BC[2]);
  doc.text("SUMARIO", ML, tocY + 4);
  doc.setLineWidth(0.3);
  doc.line(ML, tocY + 7, pageW - MR, tocY + 7);
  tocY += 14;

  const tocRight = pageW - MR;
  const lastTocPage = tocFirstPage + totalTocPages - 1;

  for (const entry of tocEntries) {
    if (tocY > pageH - MB - 10) {
      // Move to next reserved TOC page
      currentTocPage++;
      if (currentTocPage > lastTocPage) break; // safety: don't overflow past reserved pages
      doc.setPage(currentTocPage);
      tocY = USABLE_TOP;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(DARK_TEXT[0], DARK_TEXT[1], DARK_TEXT[2]);

    // Truncate long titles to fit
    const maxTitleW = tocRight - ML - 20;
    let displayTitle = entry.title;
    doc.setFontSize(10);
    if (doc.getTextWidth(displayTitle) > maxTitleW) {
      while (doc.getTextWidth(displayTitle + "...") > maxTitleW && displayTitle.length > 10) {
        displayTitle = displayTitle.substring(0, displayTitle.length - 1);
      }
      displayTitle += "...";
    }

    doc.text(displayTitle, ML, tocY);
    const titleW = doc.getTextWidth(displayTitle);
    const pageNumStr = String(entry.page);
    const pageNumW = doc.getTextWidth(pageNumStr);
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
  // PDF OUTLINE (Bookmarks)
  // ══════════════════════════════════════════
  const outline = (doc as any).outline;
  if (outline && typeof outline.add === "function") {
    bookmarks.forEach((b) => {
      const parent = outline.add(null, b.title, { pageNumber: b.page });
      if (b.children) {
        b.children.forEach((child) => outline.add(parent, child.title, { pageNumber: child.page }));
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
    addLogoWatermark(doc, logoBase64 || null);
    if (i > 1) {
      addInstitutionalHeader(doc, projectName, companyName, technicalResponsible, logoBase64, BC);
      addInstitutionalFooter(doc, i, totalPages, reportId, shortHash, companyName, generatedAt);
    }
  }

  const fileName = `Laudo-Tecnico-${projectName.replace(/\s+/g, "-").toLowerCase()}-${format(now, "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
