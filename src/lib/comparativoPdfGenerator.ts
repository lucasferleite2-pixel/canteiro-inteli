import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProjectStats {
  name: string;
  status: string;
  totalDays: number;
  avgProductivity: number;
  totalCost: number;
  avgCostPerDay: number;
  highRiskDays: number;
  riskPercent: number;
  lastProgress: number;
  avgTeam: number;
  totalHours: number;
}

const BLUE: [number, number, number] = [30, 64, 175];
const GRAY: [number, number, number] = [107, 114, 128];
const GREEN: [number, number, number] = [34, 139, 34];
const RED: [number, number, number] = [220, 38, 38];
const ORANGE: [number, number, number] = [234, 138, 0];
const PURPLE: [number, number, number] = [139, 92, 246];

const BAR_COLORS: [number, number, number][] = [BLUE, GREEN, ORANGE, PURPLE, RED, [0, 180, 180]];

function formatCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function drawBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  data: { label: string; values: number[]; }[],
  seriesLabels: string[],
  colors: [number, number, number][],
  formatFn: (v: number) => string = (v) => `${v}`,
) {
  // Title
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GRAY);
  doc.text(title, x, y);

  const chartY = y + 5;
  const chartH = h - 18;
  const chartW = w;
  const maxVal = Math.max(...data.flatMap((d) => d.values), 1);
  const groupCount = data.length;
  const seriesCount = seriesLabels.length;
  const groupWidth = chartW / groupCount;
  const barWidth = Math.min(groupWidth / (seriesCount + 1), 18);
  const gap = (groupWidth - barWidth * seriesCount) / 2;

  // Y axis line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(x, chartY, x, chartY + chartH);
  doc.line(x, chartY + chartH, x + chartW, chartY + chartH);

  // Bars
  data.forEach((group, gi) => {
    const gx = x + gi * groupWidth;
    group.values.forEach((val, si) => {
      const barH = (val / maxVal) * chartH;
      const bx = gx + gap + si * barWidth;
      const by = chartY + chartH - barH;
      const c = colors[si % colors.length];
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(bx, by, barWidth - 1, barH, "F");
      // Value on top
      if (barH > 8) {
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(255, 255, 255);
        doc.text(formatFn(val), bx + (barWidth - 1) / 2, by + 5, { align: "center" });
      }
    });
    // Label
    doc.setFontSize(6);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    const label = group.label.length > 12 ? group.label.slice(0, 12) + "…" : group.label;
    doc.text(label, gx + groupWidth / 2, chartY + chartH + 4, { align: "center" });
  });

  // Legend
  const legendY = chartY + chartH + 10;
  let lx = x;
  seriesLabels.forEach((lbl, i) => {
    const c = colors[i % colors.length];
    doc.setFillColor(c[0], c[1], c[2]);
    doc.rect(lx, legendY - 2, 4, 4, "F");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(lbl, lx + 6, legendY + 1);
    lx += doc.getTextWidth(lbl) + 12;
  });
}

function drawGaugeRow(
  doc: jsPDF,
  x: number,
  y: number,
  stats: ProjectStats[],
  metric: string,
  getValue: (s: ProjectStats) => number,
  formatFn: (v: number) => string,
  maxVal: number,
  color: [number, number, number],
) {
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GRAY);
  doc.text(metric, x, y);

  const barY = y + 3;
  const barW = 160;
  const barH = 6;
  const spacing = barH + 10;

  stats.forEach((s, i) => {
    const cy = barY + i * spacing;
    const val = getValue(s);
    const ratio = Math.min(val / maxVal, 1);

    // Label
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const label = s.name.length > 20 ? s.name.slice(0, 20) + "…" : s.name;
    doc.text(label, x, cy + 4);

    // Background bar
    const bx = x + 55;
    doc.setFillColor(230, 230, 230);
    doc.rect(bx, cy, barW, barH, "F");

    // Value bar
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(bx, cy, barW * ratio, barH, "F");

    // Value text
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(formatFn(val), bx + barW + 3, cy + 5);
  });
}

export function generateComparativoPDF(stats: ProjectStats[], companyName?: string) {
  const doc = new jsPDF("l", "mm", "a4"); // Landscape for wide table
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  // ── Cover ──
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.rect(0, 0, pageW, 55, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório Comparativo de Obras", margin, 25);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`${companyName || "Empresa"} — Análise Gerencial`, margin, 35);

  doc.setFontSize(9);
  doc.text(`Gerado em ${now} | ${stats.length} obra(s) analisada(s)`, margin, 45);

  // ── KPI Summary Table ──
  let curY = 65;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("1. Indicadores Comparativos", margin, curY);
  curY += 5;

  autoTable(doc, {
    startY: curY,
    margin: { left: margin, right: margin },
    head: [[
      "Obra", "Status", "Dias RDO", "Produtiv. (%)", "Avanço Físico (%)",
      "Custo Total", "Custo/Dia", "Risco Alto", "Equipe Média", "Horas",
    ]],
    body: stats.map((s) => [
      s.name,
      s.status,
      String(s.totalDays),
      `${s.avgProductivity.toFixed(0)}%`,
      `${s.lastProgress.toFixed(1)}%`,
      formatCurrency(s.totalCost),
      formatCurrency(s.avgCostPerDay),
      `${s.highRiskDays} (${s.riskPercent.toFixed(0)}%)`,
      s.avgTeam.toFixed(0),
      `${s.totalHours.toFixed(0)}h`,
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [BLUE[0], BLUE[1], BLUE[2]], fontSize: 7, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40 },
    },
  });

  // ── Performance Bar Chart ──
  doc.addPage("l");
  curY = margin;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("2. Desempenho Comparativo", margin, curY);
  curY += 8;

  const perfData = stats.map((s) => ({
    label: s.name,
    values: [s.avgProductivity, s.lastProgress, s.riskPercent],
  }));
  drawBarChart(
    doc, margin, curY, pageW - margin * 2, 80,
    "Produtividade × Avanço Físico × % Risco Alto",
    perfData,
    ["Produtividade (%)", "Avanço Físico (%)", "% Risco Alto"],
    [BLUE, GREEN, RED],
    (v) => `${v.toFixed(0)}`,
  );

  curY += 95;

  // ── Cost Bar Chart ──
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("3. Comparativo de Custos", margin, curY);
  curY += 8;

  const costData = stats.map((s) => ({
    label: s.name,
    values: [s.totalCost, s.avgCostPerDay],
  }));
  drawBarChart(
    doc, margin, curY, pageW - margin * 2, 80,
    "Custo Total × Custo Médio/Dia (R$)",
    costData,
    ["Custo Total", "Custo/Dia"],
    [ORANGE, PURPLE],
    (v) => formatCurrency(v),
  );

  // ── Horizontal bars page ──
  doc.addPage("l");
  curY = margin;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("4. Ranking por Indicador", margin, curY);
  curY += 10;

  // Productivity ranking
  const maxProd = Math.max(...stats.map((s) => s.avgProductivity), 1);
  drawGaugeRow(doc, margin, curY, stats, "Produtividade Média (%)", (s) => s.avgProductivity, (v) => `${v.toFixed(0)}%`, maxProd, BLUE);
  curY += 10 + stats.length * 16 + 5;

  // Cost ranking
  if (curY + stats.length * 16 + 20 > pageH - 20) { doc.addPage("l"); curY = margin; }
  const maxCost = Math.max(...stats.map((s) => s.totalCost), 1);
  drawGaugeRow(doc, margin, curY, stats, "Custo Acumulado (R$)", (s) => s.totalCost, (v) => formatCurrency(v), maxCost, ORANGE);
  curY += 10 + stats.length * 16 + 5;

  // Risk ranking
  if (curY + stats.length * 16 + 20 > pageH - 20) { doc.addPage("l"); curY = margin; }
  const maxRisk = Math.max(...stats.map((s) => s.riskPercent), 1);
  drawGaugeRow(doc, margin, curY, stats, "Proporção Risco Alto (%)", (s) => s.riskPercent, (v) => `${v.toFixed(0)}%`, maxRisk || 1, RED);

  // ── Footer on all pages ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`Relatório Comparativo — ${companyName || "Empresa"} — ${now}`, margin, pageH - 5);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin, pageH - 5, { align: "right" });
  }

  doc.save(`comparativo-obras-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
