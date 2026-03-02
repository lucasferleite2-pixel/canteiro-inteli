import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";

const BLUE = [30, 64, 175] as const;
const GRAY = [107, 114, 128] as const;

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

async function computeHash(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateQR(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 120, margin: 1 });
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

// ── Chart helpers (drawn with jsPDF primitives) ──

function drawBarChart(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  data: { label: string; value: number; color: [number, number, number] }[],
  title: string, unit: string, BC: readonly [number, number, number]
) {
  // Title
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BC[0], BC[1], BC[2]);
  doc.text(title, x, y - 4);

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.min(14, (w - 10) / data.length - 2);
  const chartBottom = y + h;
  const chartTop = y + 4;
  const chartH = chartBottom - chartTop;

  // Axis
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(x, chartTop, x, chartBottom);
  doc.line(x, chartBottom, x + w, chartBottom);

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const gy = chartBottom - (chartH * i) / 4;
    doc.setDrawColor(230, 230, 230);
    doc.line(x + 1, gy, x + w, gy);
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(String(Math.round((maxVal * i) / 4)) + unit, x - 2, gy + 1, { align: "right" });
  }

  // Bars
  data.forEach((d, i) => {
    const bx = x + 6 + i * (barW + 3);
    const bh = (d.value / maxVal) * chartH;
    const by = chartBottom - bh;
    doc.setFillColor(d.color[0], d.color[1], d.color[2]);
    doc.roundedRect(bx, by, barW, bh, 1, 1, "F");
    // Label
    doc.setFontSize(5);
    doc.setTextColor(80, 80, 80);
    const label = d.label.length > 5 ? d.label.substring(0, 5) : d.label;
    doc.text(label, bx + barW / 2, chartBottom + 4, { align: "center" });
  });
}

function drawGauge(
  doc: jsPDF, cx: number, cy: number, radius: number,
  value: number, label: string, BC: readonly [number, number, number]
) {
  // Background arc (simple filled circle segments)
  const r = radius;
  doc.setFillColor(230, 230, 230);
  doc.circle(cx, cy, r, "F");

  // Value sector
  const clampedVal = Math.min(100, Math.max(0, value));
  const color: [number, number, number] = clampedVal >= 70 ? [34, 197, 94] : clampedVal >= 50 ? [234, 179, 8] : [239, 68, 68];
  doc.setFillColor(color[0], color[1], color[2]);

  // Draw as pie slice approximation
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (clampedVal / 100) * 2 * Math.PI;
  const segments = Math.max(2, Math.round(clampedVal / 2));
  const points: [number, number][] = [[cx, cy]];
  for (let i = 0; i <= segments; i++) {
    const a = startAngle + (i / segments) * (endAngle - startAngle);
    points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  // Draw polygon
  if (points.length > 2) {
    doc.setFillColor(color[0], color[1], color[2]);
    const path = points.map((p, i) => `${i === 0 ? "" : ""}${p[0].toFixed(2)} ${p[1].toFixed(2)}`);
    // Use triangle fan approach
    for (let i = 1; i < points.length - 1; i++) {
      doc.triangle(
        points[0][0], points[0][1],
        points[i][0], points[i][1],
        points[i + 1][0], points[i + 1][1],
        "F"
      );
    }
  }

  // Inner white circle
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, r * 0.6, "F");

  // Value text
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(`${clampedVal}%`, cx, cy + 2, { align: "center" });

  // Label
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text(label, cx, cy + r + 6, { align: "center" });
}

// ── Main generator ──

export async function generateRdoPDF(
  options: RdoPdfOptions,
  companyId: string,
  onProgress?: (step: string) => void
): Promise<void> {
  const {
    projectName, companyName, companyAddress, companyPhone, technicalResponsible,
    rdos, userName, aiSummary, logoBase64, brandColor,
    includePhotos = true, includeActivities = true, includeOccurrences = true, includeMaterials = true, includeDespesas = true,
  } = options;

  const BC = brandColor ? hexToRgb(brandColor) : BLUE;
  const doc = new jsPDF();
  const now = new Date();
  const generatedAt = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const reportId = `RDO2-${format(now, "yyyyMMddHHmmss")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  // Height reserved for the header drawn in the final loop (pages > 1)
  const HEADER_OFFSET = 20;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Hash
  onProgress?.("Calculando hash de integridade...");
  const integrityHash = await computeHash(JSON.stringify({ reportId, projectName, generated: now.toISOString(), count: rdos.length, ids: rdos.map((r) => r.id) }));
  const shortHash = integrityHash.substring(0, 16).toUpperCase();

  // QR
  onProgress?.("Gerando QR Code...");
  const qrDataUrl = await generateQR(JSON.stringify({ id: reportId, hash: shortHash, project: projectName, entries: rdos.length, generated: now.toISOString() }));

  // Sort chronologically
  const sorted = [...rdos].sort((a, b) => a.data.localeCompare(b.data));

  // Bookmark & TOC tracking
  const bookmarks: { title: string; page: number; children?: { title: string; page: number }[] }[] = [];
  function trackSection(title: string) {
    bookmarks.push({ title, page: doc.getNumberOfPages() });
  }

  // ═══════════════════════════════════════
  // PAGE 1: COVER
  // ═══════════════════════════════════════
  onProgress?.("Gerando capa...");
  doc.setFillColor(BC[0], BC[1], BC[2]);
  doc.rect(0, 0, pageW, 8, "F");
  doc.rect(0, pageH - 8, pageW, 8, "F");

  if (logoBase64) {
    try { doc.addImage(logoBase64, "PNG", (pageW - 50) / 2, 16, 50, 25); } catch {}
  }

  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BC[0], BC[1], BC[2]);
  doc.text("RELATÓRIO RDO 2.0", pageW / 2, 52, { align: "center" });
  doc.setFontSize(14);
  doc.text("DIÁRIO DE OBRA INTELIGENTE", pageW / 2, 62, { align: "center" });

  doc.setDrawColor(BC[0], BC[1], BC[2]);
  doc.setLineWidth(0.8);
  doc.line(50, 68, pageW - 50, 68);

  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  doc.text(projectName, pageW / 2, 80, { align: "center" });

  let detailY = 88;
  doc.setFontSize(10);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  if (companyName) { doc.text(companyName, pageW / 2, detailY, { align: "center" }); detailY += 6; }
  doc.setFontSize(8);
  if (companyAddress) { doc.text(companyAddress, pageW / 2, detailY, { align: "center" }); detailY += 5; }
  if (companyPhone) { doc.text(`Tel: ${companyPhone}`, pageW / 2, detailY, { align: "center" }); detailY += 5; }
  if (technicalResponsible) { doc.text(`Resp. Técnico: ${technicalResponsible}`, pageW / 2, detailY, { align: "center" }); }

  // Metadata box
  const boxY = 115;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(30, boxY, pageW - 60, 55, 3, 3, "F");

  doc.setFontSize(9);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  const period = sorted.length > 0 ? `${fmtDateShort(sorted[0].data)} a ${fmtDateShort(sorted[sorted.length - 1].data)}` : "—";
  const meta = [
    `Nº do Relatório: ${reportId}`,
    `Data de Geração: ${generatedAt}`,
    `Gerado por: ${userName || "Sistema"}`,
    `Total de Registros RDO: ${rdos.length}`,
    `Período: ${period}`,
    `Tipo: Relatório RDO 2.0 — Dados Estruturados`,
  ];
  meta.forEach((line, i) => doc.text(line, 38, boxY + 10 + i * 8));

  doc.addImage(qrDataUrl, "PNG", pageW - 70, boxY + 4, 30, 30);
  doc.setFontSize(6);
  doc.text("Verificação", pageW - 55, boxY + 37, { align: "center" });
  doc.setFontSize(7);
  doc.text(`Hash de Integridade (SHA-256): ${shortHash}`, pageW / 2, boxY + 51, { align: "center" });

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Documento gerado pelo sistema Canteiro Inteli — RDO 2.0", pageW / 2, pageH - 16, { align: "center" });

  // ═══════════════════════════════════════
  // COMPUTE KPIs
  // ═══════════════════════════════════════
  const totalCost = sorted.reduce((s, r) => s + Number(r.custo_dia || 0), 0);
  const avgTeam = sorted.length > 0 ? Math.round(sorted.reduce((s, r) => s + r.equipe_total, 0) / sorted.length) : 0;
  const avgProd = sorted.length > 0 ? Math.round(sorted.reduce((s, r) => s + Number(r.produtividade_percentual || 0), 0) / sorted.length) : 0;
  const maxPhysical = sorted.length > 0 ? Math.max(...sorted.map((r) => Number(r.percentual_fisico_acumulado || 0))) : 0;
  const totalHours = sorted.reduce((s, r) => s + Number(r.horas_trabalhadas || 0), 0);
  const riskCount: Record<string, number> = {};
  const climaCount: Record<string, number> = {};
  const faseCount: Record<string, number> = {};
  sorted.forEach((r) => {
    riskCount[r.risco_dia || "baixo"] = (riskCount[r.risco_dia || "baixo"] || 0) + 1;
    climaCount[r.clima] = (climaCount[r.clima] || 0) + 1;
    if (r.fase_obra) faseCount[r.fase_obra] = (faseCount[r.fase_obra] || 0) + 1;
  });

  // ═══════════════════════════════════════
  // PAGE 2: SUMÁRIO
  // ═══════════════════════════════════════
  onProgress?.("Gerando sumário...");
  doc.addPage();
  trackSection("Sumário");
  addSectionHeader(doc, "Sumário", 24, BC);

  const tocPageNum = doc.getNumberOfPages();
  // TOC content drawn at the end with correct page numbers

  // ═══════════════════════════════════════
  // SECTION 1: EXECUTIVE SUMMARY & KPIs
  // ═══════════════════════════════════════
  onProgress?.("Gerando resumo executivo...");
  doc.addPage();
  trackSection("1. Resumo Executivo & KPIs");
  addSectionHeader(doc, "1. Resumo Executivo & KPIs", 24, BC);

  autoTable(doc, {
    startY: 38,
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
      ...Object.entries(climaCount).map(([w, c]) => [`Clima: ${w}`, `${c} dia(s)`]),
      ...Object.entries(faseCount).map(([f, c]) => [`Fase: ${f}`, `${c} dia(s)`]),
    ],
    theme: "grid",
    headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
    styles: { fontSize: 9 },
    margin: { top: HEADER_OFFSET + 4 },
  });

  // Financial Integration Summary in executive section
  if (includeDespesas) {
    let totalDespesasPdf = 0;
    let totalNaoPrevistoPdf = 0;
    let despesaCountPdf = 0;
    for (const rdo of sorted) {
      const desp = await fetchDespesas(rdo.id);
      const pdfDesp = desp.filter((d: any) => d.incluir_no_pdf);
      despesaCountPdf += pdfDesp.length;
      totalDespesasPdf += pdfDesp.reduce((s: number, d: any) => s + Number(d.valor_total || 0), 0);
      totalNaoPrevistoPdf += pdfDesp.filter((d: any) => !d.previsto_no_orcamento).reduce((s: number, d: any) => s + Number(d.valor_total || 0), 0);
    }
    if (despesaCountPdf > 0) {
      const yAfterExec = (doc as any).lastAutoTable?.finalY ?? 100;
      if (yAfterExec < pageH - 60) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(BC[0], BC[1], BC[2]);
        doc.text("Integração Financeira", 14, yAfterExec + 10);
        autoTable(doc, {
          startY: yAfterExec + 14,
          head: [["Indicador", "Valor"]],
          body: [
            ["Lançamentos automáticos gerados", String(despesaCountPdf)],
            ["Total integrado ao financeiro", `R$ ${totalDespesasPdf.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
            ["Despesas não previstas", `R$ ${totalNaoPrevistoPdf.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
          ],
          theme: "grid",
          headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
          styles: { fontSize: 9 },
          margin: { top: HEADER_OFFSET + 4 },
        });
      }
    }
  }

  // ═══════════════════════════════════════
  // SECTION 2: CHARTS
  // ═══════════════════════════════════════
  onProgress?.("Gerando gráficos...");
  doc.addPage();
  trackSection("2. Gráficos de Desempenho");
  addSectionHeader(doc, "2. Gráficos de Desempenho", 24, BC);

  // Productivity gauge
  drawGauge(doc, 40, 60, 18, avgProd, "Produtividade Média", BC);

  // Physical progress gauge
  drawGauge(doc, 100, 60, 18, maxPhysical, "Avanço Físico", BC);

  // Risk distribution gauge (% of high risk days)
  const highRiskPct = sorted.length > 0 ? Math.round(((riskCount["alto"] || 0) / sorted.length) * 100) : 0;
  drawGauge(doc, 160, 60, 18, highRiskPct, "Risco Alto (%)", BC);

  // Productivity per day bar chart (last 10 days)
  const last10 = sorted.slice(-10);
  if (last10.length > 0) {
    drawBarChart(doc, 14, 100, pageW - 28, 55, last10.map((r) => ({
      label: fmtDateShort(r.data).substring(0, 5),
      value: Number(r.produtividade_percentual || 0),
      color: Number(r.produtividade_percentual || 0) >= 70 ? [34, 197, 94] : Number(r.produtividade_percentual || 0) >= 50 ? [234, 179, 8] : [239, 68, 68],
    })), "Produtividade por Dia (últimos 10 registros)", "%", BC);
  }

  // Cost per day bar chart
  if (last10.length > 0) {
    drawBarChart(doc, 14, 175, pageW - 28, 55, last10.map((r) => ({
      label: fmtDateShort(r.data).substring(0, 5),
      value: Number(r.custo_dia || 0),
      color: [BC[0], BC[1], BC[2]] as [number, number, number],
    })), "Custo Diário (R$) — últimos 10 registros", "", BC);
  }

  // ═══════════════════════════════════════
  // SECTION: PERFORMANCE BY PHASE
  // ═══════════════════════════════════════
  const fasePerformance = new Map<string, { qtd: number; custo: number; unidade: string }>();
  sorted.forEach((r) => {
    const fase = r.fase_obra || "Sem fase";
    if (!fasePerformance.has(fase)) fasePerformance.set(fase, { qtd: 0, custo: 0, unidade: (r as any).unidade_medicao || "m²" });
    const entry = fasePerformance.get(fase)!;
    entry.qtd += Number((r as any).quantidade_executada || 0);
    entry.custo += Number(r.custo_dia || 0);
  });

  if (fasePerformance.size > 0) {
    onProgress?.("Gerando indicadores de performance...");
    doc.addPage();
    trackSection("3. Indicadores de Performance por Fase");
    addSectionHeader(doc, "3. Indicadores de Performance por Fase", 24, BC);

    const perfBody = Array.from(fasePerformance.entries()).map(([fase, data]) => {
      const custoPorUnidade = data.qtd > 0 ? data.custo / data.qtd : 0;
      return [
        fase,
        `${data.qtd.toLocaleString("pt-BR")} ${data.unidade}`,
        `R$ ${data.custo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        data.qtd > 0 ? `R$ ${custoPorUnidade.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/${data.unidade}` : "N/A",
      ];
    });

    autoTable(doc, {
      startY: 38,
      head: [["Fase", "Qtd. Executada", "Custo Acumulado", "Custo por Unidade"]],
      body: perfBody,
      theme: "grid",
      headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
      styles: { fontSize: 9 },
      margin: { top: HEADER_OFFSET + 4 },
    });
  }

  // ═══════════════════════════════════════
  // SECTION: PREDICTIVE ANALYSIS
  // ═══════════════════════════════════════
  let nextSection = fasePerformance.size > 0 ? 4 : 3;

  // Build projection data from phase performance
  const projectionRows: string[][] = [];
  fasePerformance.forEach((data, fase) => {
    if (data.qtd > 0) {
      const custoPorUnidade = data.custo / data.qtd;
      // Rough projection: if we had a planned total, project
      const projectedTotal = custoPorUnidade * data.qtd * 2; // simplified
      projectionRows.push([
        fase,
        `R$ ${data.custo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        `R$ ${custoPorUnidade.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/${data.unidade}`,
        `${data.qtd.toLocaleString("pt-BR")} ${data.unidade}`,
      ]);
    }
  });

  if (projectionRows.length > 0) {
    onProgress?.("Gerando análise preditiva...");
    doc.addPage();
    trackSection(`${nextSection}. Análise Preditiva de Estouro`);
    addSectionHeader(doc, `${nextSection}. Análise Preditiva de Estouro`, 24, BC);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("Projeção baseada em regressão linear simples sobre o custo por unidade executada.", 14, 36);

    autoTable(doc, {
      startY: 42,
      head: [["Fase", "Custo Real", "Custo/Unidade", "Qtd. Executada"]],
      body: projectionRows,
      theme: "grid",
      headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
      styles: { fontSize: 9 },
      margin: { top: HEADER_OFFSET + 4 },
    });
    nextSection++;
  }

  // ═══════════════════════════════════════
  // SECTION: AI SUMMARY (optional)
  // ═══════════════════════════════════════
  let sectionNum = nextSection;
  if (aiSummary) {
    onProgress?.("Adicionando análise IA...");
    doc.addPage();
    trackSection(`${sectionNum}. Análise Inteligente (IA)`);
    addSectionHeader(doc, `${sectionNum}. Análise Inteligente (IA)`, 24, BC);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(aiSummary, pageW - 32);
    doc.text(lines, 16, 40);
    sectionNum++;
  }

  // ═══════════════════════════════════════
  // SECTION: CHRONOLOGICAL ENTRIES
  // ═══════════════════════════════════════
  onProgress?.("Gerando registros cronológicos...");
  doc.addPage();
  trackSection(`${sectionNum}. Registros Cronológicos Detalhados`);
  addSectionHeader(doc, `${sectionNum}. Registros Cronológicos Detalhados`, 24, BC);

  // Summary table
  autoTable(doc, {
    startY: 38,
    head: [["Data", "Clima", "Equipe", "Prod. %", "Custo R$", "Avanço %", "Risco"]],
    body: sorted.map((r) => [
      fmtDateShort(r.data),
      r.clima,
      String(r.equipe_total),
      `${r.produtividade_percentual}%`,
      Number(r.custo_dia || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      `${r.percentual_fisico_acumulado}%`,
      r.risco_dia || "baixo",
    ]),
    theme: "grid",
    headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
    styles: { fontSize: 7, cellPadding: 2 },
    margin: { top: HEADER_OFFSET + 4 },
  });

  // Detailed entries
  const chronSectionIdx = bookmarks.length - 1; // index of "Registros Cronológicos" bookmark
  for (let idx = 0; idx < sorted.length; idx++) {
    const rdo = sorted[idx];
    onProgress?.(`Processando RDO ${idx + 1}/${sorted.length}...`);
    doc.addPage();
    // Track sub-bookmark for this day
    if (!bookmarks[chronSectionIdx].children) bookmarks[chronSectionIdx].children = [];
    bookmarks[chronSectionIdx].children!.push({ title: fmtDateShort(rdo.data), page: doc.getNumberOfPages() });

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BC[0], BC[1], BC[2]);
    doc.text(fmtDate(rdo.data), 14, HEADER_OFFSET + 6);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    const metaLine = [
      `Clima: ${rdo.clima}`,
      `Equipe: ${rdo.equipe_total}`,
      `Prod: ${rdo.produtividade_percentual}%`,
      `Custo: R$ ${Number(rdo.custo_dia || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `Risco: ${rdo.risco_dia || "baixo"}`,
      rdo.fase_obra ? `Fase: ${rdo.fase_obra}` : null,
      rdo.is_locked ? "🔒" : null,
    ].filter(Boolean).join("  |  ");
    doc.text(metaLine, 14, HEADER_OFFSET + 12);

    let y = HEADER_OFFSET + 20;

    if (rdo.observacoes_gerais) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(80, 80, 80);
      const obsLines = doc.splitTextToSize(rdo.observacoes_gerais, pageW - 28);
      doc.text(obsLines, 14, y);
      y += obsLines.length * 4.5 + 4;
    }

    // Activities
    if (includeActivities) {
      const atividades = await fetchAtividades(rdo.id);
      if (atividades.length > 0) {
        if (y > pageH - 40) { doc.addPage(); y = HEADER_OFFSET + 4; }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40, 40, 40);
        doc.text("Atividades", 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          margin: { top: HEADER_OFFSET + 4 },
          head: [["Descrição", "Tipo", "Impacto", "Concluída"]],
          body: atividades.map((a: any) => [
            a.descricao.substring(0, 80),
            a.tipo_atividade,
            a.impacto_cronograma || "nenhum",
            a.concluida ? "Sim" : "Não",
          ]),
          theme: "grid",
          headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
          styles: { fontSize: 7, cellPadding: 1.5 },
        });
        y = (doc as any).lastAutoTable?.finalY + 6 || y + 20;
      }
    }

    // Materials
    if (includeMaterials) {
      const materiais = await fetchMateriais(rdo.id);
      if (materiais.length > 0) {
        if (y > pageH - 40) { doc.addPage(); y = HEADER_OFFSET + 4; }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40, 40, 40);
        doc.text("Materiais & Custos", 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          margin: { top: HEADER_OFFSET + 4 },
          head: [["Item", "Tipo", "Qtd", "Unidade", "V. Unit.", "V. Total", "Orçamento"]],
          body: materiais.map((m: any) => [
            m.item.substring(0, 40),
            m.tipo,
            String(m.quantidade || 0),
            m.unidade || "un",
            `R$ ${Number(m.valor_unitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            `R$ ${Number(m.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            m.previsto_em_orcamento ? "Sim" : "Não",
          ]),
          theme: "grid",
          headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
          styles: { fontSize: 7, cellPadding: 1.5 },
        });
        y = (doc as any).lastAutoTable?.finalY + 6 || y + 20;
      }
    }

    // Occurrences
    if (includeOccurrences) {
      const ocorrencias = await fetchOcorrencias(rdo.id);
      if (ocorrencias.length > 0) {
        if (y > pageH - 40) { doc.addPage(); y = HEADER_OFFSET + 4; }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40, 40, 40);
        doc.text("Ocorrências", 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          margin: { top: HEADER_OFFSET + 4 },
          head: [["Descrição", "Tipo", "Impacto", "Responsável", "Risco Contratual"]],
          body: ocorrencias.map((o: any) => [
            o.descricao.substring(0, 60),
            o.tipo_ocorrencia,
            o.impacto || "baixo",
            o.responsavel || "—",
            o.gera_risco_contratual ? "⚠️ Sim" : "Não",
          ]),
          theme: "grid",
          headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
          styles: { fontSize: 7, cellPadding: 1.5 },
        });
        y = (doc as any).lastAutoTable?.finalY + 6 || y + 20;
      }
    }

    // Despesas
    if (includeDespesas) {
      const despesas = await fetchDespesas(rdo.id);
      const despesasPdf = despesas.filter((d: any) => d.incluir_no_pdf);
      if (despesasPdf.length > 0) {
        if (y > pageH - 40) { doc.addPage(); y = HEADER_OFFSET + 4; }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40, 40, 40);
        doc.text("💰 Despesas do Dia", 14, y);
        y += 2;
        const tipoLabels: Record<string, string> = { material: "Material", mao_de_obra: "Mão de Obra", equipamento: "Equipamento", transporte: "Transporte", outro: "Outro" };
        autoTable(doc, {
          startY: y,
          margin: { top: HEADER_OFFSET + 4 },
          head: [["Descrição", "Tipo", "Qtd", "Unid.", "V. Unit.", "V. Total"]],
          body: despesasPdf.map((d: any) => [
            d.descricao.substring(0, 50),
            tipoLabels[d.tipo] || d.tipo,
            String(d.quantidade || 0),
            d.unidade || "un",
            `R$ ${Number(d.valor_unitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            `R$ ${Number(d.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          ]),
          theme: "grid",
          headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
          styles: { fontSize: 7, cellPadding: 1.5 },
        });
        y = (doc as any).lastAutoTable?.finalY + 2 || y + 20;
        const subtotal = despesasPdf.reduce((s: number, d: any) => s + Number(d.valor_total || 0), 0);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40, 40, 40);
        doc.text(`Subtotal: R$ ${subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, y + 3);
        y += 10;
      }
    }
  }
  sectionNum++;

  // ═══════════════════════════════════════
  // SECTION: PHOTOS
  // ═══════════════════════════════════════
  if (includePhotos) {
    onProgress?.("Carregando fotos...");
    doc.addPage();
    trackSection(`${sectionNum}. Registro Fotográfico`);
    addSectionHeader(doc, `${sectionNum}. Registro Fotográfico`, 24, BC);

    let photoY = 38;
    let hasPhotos = false;

    for (const rdo of sorted) {
      const fotos = await fetchFotos(rdo.id);
      if (fotos.length === 0) continue;
      hasPhotos = true;

      if (photoY > pageH - 60) { doc.addPage(); photoY = HEADER_OFFSET + 4; }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(BC[0], BC[1], BC[2]);
      doc.text(fmtDate(rdo.data), 14, photoY);
      photoY += 6;

      for (const foto of fotos) {
        if (photoY > pageH - 80) { doc.addPage(); photoY = HEADER_OFFSET + 4; }
        const base64 = await loadImageAsBase64(foto.url);
        if (base64) {
          try {
            const imgW = 80, imgH = 60;
            doc.addImage(base64, "JPEG", 14, photoY, imgW, imgH);
            const captionX = 100;
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(40, 40, 40);
            doc.text(foto.file_name, captionX, photoY + 6);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
            let cY = photoY + 12;
            if (foto.descricao) {
              const dl = doc.splitTextToSize(foto.descricao, pageW - captionX - 14);
              doc.text(dl, captionX, cY);
              cY += dl.length * 4 + 2;
            }
            if (foto.fase_obra) { doc.text(`Fase: ${foto.fase_obra}`, captionX, cY); cY += 5; }
            if (foto.tag_risco && foto.tag_risco !== "nenhuma") { doc.text(`Risco: ${foto.tag_risco}`, captionX, cY); cY += 5; }
            if (foto.data_captura) {
              doc.text(`Captura: ${format(new Date(foto.data_captura), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, captionX, cY); cY += 5;
            }
            if (foto.latitude && foto.longitude) {
              doc.text(`GPS: ${foto.latitude.toFixed(5)}, ${foto.longitude.toFixed(5)}`, captionX, cY);
            }
            photoY += imgH + 8;
          } catch { /* skip */ }
        }
      }
    }

    if (!hasPhotos) {
      doc.setFontSize(9);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text("Nenhuma foto registrada no período.", 14, photoY);
    }
    sectionNum++;
  }

  // ═══════════════════════════════════════
  // LAST PAGE: VERIFICATION
  // ═══════════════════════════════════════
  onProgress?.("Finalizando documento...");
  doc.addPage();
  trackSection(`${sectionNum}. Informações de Verificação`);
  addSectionHeader(doc, `${sectionNum}. Informações de Verificação`, 24, BC);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  [
    `Nº do Relatório: ${reportId}`,
    `Hash SHA-256: ${integrityHash}`,
    `Hash Resumido: ${shortHash}`,
    `Data/Hora de Geração: ${now.toISOString()}`,
    `Gerado por: ${userName || "Sistema"}`,
    `Obra: ${projectName}`,
    `Total de Registros RDO: ${sorted.length}`,
  ].forEach((line, i) => doc.text(line, 14, 40 + i * 7));

  doc.addImage(qrDataUrl, "PNG", 14, 96, 40, 40);
  doc.setFontSize(7);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text("Escaneie o QR Code para verificar a autenticidade deste relatório.", 14, 142);

  // ═══════════════════════════════════════
  // DRAW TOC WITH PAGE NUMBERS
  // ═══════════════════════════════════════
  const tocEntries = bookmarks.filter((b) => b.title !== "Sumário");
  doc.setPage(tocPageNum);
  let tocY = 40;
  const tocLeftMain = 20;
  const tocLeftSub = 30;
  const tocRight = pageW - 20;

  for (const entry of tocEntries) {
    if (tocY > pageH - 20) { doc.addPage(); tocY = HEADER_OFFSET + 10; }

    // Main entry
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.text(entry.title, tocLeftMain, tocY);
    const titleW = doc.getTextWidth(entry.title);
    const pageNumStr = String(entry.page);
    const pageNumW = doc.getTextWidth(pageNumStr);
    const dotsStart = tocLeftMain + titleW + 2;
    const dotsEnd = tocRight - pageNumW - 2;
    if (dotsEnd > dotsStart) {
      doc.setTextColor(180, 180, 180);
      const dotStr = ".".repeat(Math.floor((dotsEnd - dotsStart) / doc.getTextWidth(".")));
      doc.text(dotStr, dotsStart, tocY);
    }
    doc.setTextColor(BC[0], BC[1], BC[2]);
    doc.text(pageNumStr, tocRight, tocY, { align: "right" });
    tocY += 8;

    // Sub-entries (children) with visual indent
    if (entry.children && entry.children.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      for (const child of entry.children) {
        if (tocY > pageH - 15) { doc.addPage(); tocY = HEADER_OFFSET + 10; }
        doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
        const childLabel = `– ${child.title}`;
        doc.text(childLabel, tocLeftSub, tocY);
        const cTitleW = doc.getTextWidth(childLabel);
        const cPageStr = String(child.page);
        const cPageW = doc.getTextWidth(cPageStr);
        const cDotsStart = tocLeftSub + cTitleW + 2;
        const cDotsEnd = tocRight - cPageW - 2;
        if (cDotsEnd > cDotsStart) {
          doc.setTextColor(200, 200, 200);
          const cDotStr = ".".repeat(Math.floor((cDotsEnd - cDotsStart) / doc.getTextWidth(".")));
          doc.text(cDotStr, cDotsStart, tocY);
        }
        doc.setTextColor(BC[0], BC[1], BC[2]);
        doc.text(cPageStr, tocRight, tocY, { align: "right" });
        tocY += 6;
      }
      tocY += 2; // extra spacing after children
    }
  }

  // ═══════════════════════════════════════
  // PDF OUTLINE (Bookmarks for navigation)
  // ═══════════════════════════════════════
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

  // ═══════════════════════════════════════
  // HEADERS & FOOTERS
  // ═══════════════════════════════════════
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) {
      doc.setFillColor(BC[0], BC[1], BC[2]);
      doc.rect(0, 0, pageW, 2, "F");
      let hx = 14;
      if (logoBase64) {
        try { doc.addImage(logoBase64, "PNG", hx, 5, 14, 7); hx += 17; } catch {}
      }
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(BC[0], BC[1], BC[2]);
      if (companyName) { doc.text(companyName, hx, 9); }
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      const hd = [companyAddress, companyPhone ? `Tel: ${companyPhone}` : null, technicalResponsible ? `Resp: ${technicalResponsible}` : null].filter(Boolean).join("  |  ");
      if (hd) doc.text(hd, 14, 13);
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(14, 16, pageW - 14, 16);
    }
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`${reportId}  |  Hash: ${shortHash}`, 14, pageH - 6);
    doc.text(`Página ${i} de ${totalPages}`, pageW - 14, pageH - 6, { align: "right" });
  }

  const fileName = `RDO2-${projectName.replace(/\s+/g, "-").toLowerCase()}-${format(now, "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}

function addSectionHeader(doc: jsPDF, title: string, y = 24, color: readonly [number, number, number] = BLUE) {
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(title, 14, y);
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.4);
  doc.line(14, y + 3, 100, y + 3);
}
