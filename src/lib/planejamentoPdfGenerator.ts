import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const BLUE: [number, number, number] = [30, 64, 175];
const GRAY: [number, number, number] = [107, 114, 128];
const WHITE: [number, number, number] = [255, 255, 255];

const CHART_COLORS: [number, number, number][] = [
  [30, 64, 175],
  [16, 185, 129],
  [245, 158, 11],
  [239, 68, 68],
  [139, 92, 246],
  [6, 182, 212],
  [236, 72, 153],
  [251, 146, 60],
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatNumber = (v: number) =>
  new Intl.NumberFormat("pt-BR").format(v);

interface FasePlanejamento {
  id: string;
  fase: string;
  quantidade_planejada: number;
  custo_planejado: number;
  unidade: string;
}

interface PlanejamentoPdfParams {
  obraName: string;
  obraBudget: number;
  fases: FasePlanejamento[];
  companyName?: string;
  companyLogoUrl?: string;
}

export async function generatePlanejamentoPdf({ obraName, obraBudget, fases, companyName, companyLogoUrl }: PlanejamentoPdfParams) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  // ── Load logo if available ──
  let logoImg: HTMLImageElement | null = null;
  if (companyLogoUrl) {
    try {
      logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = companyLogoUrl;
      });
    } catch {
      logoImg = null;
    }
  }

  // ── Header ──
  const headerH = 32;
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, pageW, headerH, "F");

  let textStartX = margin;
  if (logoImg) {
    const logoH = 18;
    const logoW = (logoImg.width / logoImg.height) * logoH;
    const logoY = (headerH - logoH) / 2;
    doc.addImage(logoImg, "PNG", margin, logoY, logoW, logoH);
    textStartX = margin + logoW + 4;
  }

  doc.setTextColor(...WHITE);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Planejamento por Fase", textStartX, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(obraName, textStartX, 22);
  doc.text(format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }), pageW - margin, 22, { align: "right" });
  if (companyName) {
    doc.text(companyName, pageW - margin, 14, { align: "right" });
  }

  y = headerH + 8;

  // ── KPI Cards ──
  const totalPlanejado = fases.reduce((s, f) => s + f.custo_planejado, 0);
  const cobertura = obraBudget > 0 ? ((totalPlanejado / obraBudget) * 100).toFixed(1) : "0.0";

  const kpis = [
    { label: "Orçamento da Obra", value: formatCurrency(obraBudget) },
    { label: "Total Planejado (Fases)", value: formatCurrency(totalPlanejado) },
    { label: "Cobertura Orçamentária", value: `${cobertura}%` },
    { label: "Fases Cadastradas", value: String(fases.length) },
  ];

  const kpiW = (pageW - margin * 2 - 6 * 3) / 4;
  kpis.forEach((kpi, i) => {
    const x = margin + i * (kpiW + 6);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(x, y, kpiW, 20, 2, 2, "F");
    doc.setTextColor(...GRAY);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.label, x + 3, y + 7);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.value, x + 3, y + 16);
  });

  y += 28;

  // ── Table ──
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Fases Cadastradas", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Fase", "Qtd. Planejada", "Unidade", "Custo Planejado", "Custo/Unidade", "% do Total"]],
    body: fases.map((f) => [
      f.fase,
      formatNumber(f.quantidade_planejada),
      f.unidade,
      formatCurrency(f.custo_planejado),
      f.quantidade_planejada > 0 ? formatCurrency(f.custo_planejado / f.quantidade_planejada) : "—",
      totalPlanejado > 0 ? `${((f.custo_planejado / totalPlanejado) * 100).toFixed(1)}%` : "0%",
    ]),
    headStyles: { fillColor: BLUE, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Check page space for charts ──
  if (y > 200) {
    doc.addPage();
    y = margin;
  }

  // ── Bar Chart (drawn manually) ──
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Distribuição de Custo por Fase", margin, y);
  y += 6;

  const chartX = margin;
  const chartW = (pageW - margin * 2) * 0.55;
  const chartH = 60;
  const maxCusto = Math.max(...fases.map((f) => f.custo_planejado), 1);

  // Y axis labels
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  for (let i = 0; i <= 4; i++) {
    const val = (maxCusto / 4) * i;
    const ly = y + chartH - (chartH / 4) * i;
    doc.text(`R$${(val / 1000).toFixed(0)}k`, chartX, ly - 1);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(chartX + 18, ly, chartX + chartW, ly);
  }

  // Bars
  const barAreaX = chartX + 20;
  const barAreaW = chartW - 22;
  const barW = Math.min(barAreaW / fases.length - 4, 20);
  const gap = (barAreaW - barW * fases.length) / (fases.length + 1);

  fases.forEach((f, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const barH = (f.custo_planejado / maxCusto) * (chartH - 4);
    const bx = barAreaX + gap + i * (barW + gap);
    const by = y + chartH - barH;

    doc.setFillColor(...color);
    doc.roundedRect(bx, by, barW, barH, 1, 1, "F");

    doc.setFontSize(5);
    doc.setTextColor(...GRAY);
    doc.text(f.fase, bx + barW / 2, y + chartH + 4, { align: "center" });
  });

  // ── Pie Chart (drawn manually) ──
  const pieX = margin + chartW + 15;
  const pieCx = pieX + (pageW - margin - pieX) / 2;
  const pieCy = y + chartH / 2;
  const pieR = 25;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Proporção (%)", pieX, y - 2);

  let startAngle = -Math.PI / 2;
  fases.forEach((f, i) => {
    const proportion = totalPlanejado > 0 ? f.custo_planejado / totalPlanejado : 0;
    const endAngle = startAngle + proportion * 2 * Math.PI;
    const color = CHART_COLORS[i % CHART_COLORS.length];

    // Draw pie slice using filled triangle approximation
    doc.setFillColor(...color);
    const steps = Math.max(Math.ceil(proportion * 60), 2);
    for (let s = 0; s < steps; s++) {
      const a1 = startAngle + (s / steps) * (endAngle - startAngle);
      const a2 = startAngle + ((s + 1) / steps) * (endAngle - startAngle);
      const x1 = pieCx + pieR * Math.cos(a1);
      const y1 = pieCy + pieR * Math.sin(a1);
      const x2 = pieCx + pieR * Math.cos(a2);
      const y2 = pieCy + pieR * Math.sin(a2);
      doc.triangle(pieCx, pieCy, x1, y1, x2, y2, "F");
    }

    // Label
    const midAngle = (startAngle + endAngle) / 2;
    const lx = pieCx + (pieR + 8) * Math.cos(midAngle);
    const ly = pieCy + (pieR + 8) * Math.sin(midAngle);
    doc.setFontSize(5.5);
    doc.setTextColor(30, 30, 30);
    if (proportion > 0.03) {
      doc.text(`${f.fase} ${(proportion * 100).toFixed(1)}%`, lx, ly, { align: "center" });
    }

    startAngle = endAngle;
  });

  // Legend
  let legendY = y + chartH + 10;
  doc.setFontSize(6);
  fases.forEach((f, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    doc.setFillColor(...color);
    doc.rect(pieX, legendY, 3, 3, "F");
    doc.setTextColor(30, 30, 30);
    doc.text(`${f.fase} – ${formatCurrency(f.custo_planejado)}`, pieX + 5, legendY + 2.5);
    legendY += 5;
  });

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} | Página ${p} de ${pageCount}`,
      pageW / 2,
      pageH - 6,
      { align: "center" }
    );
  }

  doc.save(`planejamento-${obraName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
