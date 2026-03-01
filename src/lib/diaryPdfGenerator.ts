import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";

const weatherLabels: Record<string, string> = {
  ensolarado: "Ensolarado",
  nublado: "Nublado",
  chuvoso: "Chuvoso",
  tempestade: "Tempestade",
  neve: "Neve/Frio Extremo",
};

const BLUE = [30, 64, 175] as const; // brand blue
const GRAY = [107, 114, 128] as const;

interface DiaryEntry {
  id: string;
  entry_date: string;
  weather: string | null;
  team_count: number | null;
  activities: string | null;
  occurrences: string | null;
  materials: string | null;
  technical_comments: string | null;
  is_locked: boolean | null;
  projects?: { name: string } | null;
}

interface DiaryPhoto {
  id: string;
  storage_path: string;
  file_name: string;
  description: string | null;
  activity: string | null;
  captured_at: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PdfContentFilters {
  includePhotos?: boolean;
  includeActivities?: boolean;
  includeOccurrences?: boolean;
  includeMaterials?: boolean;
  includeTechnicalComments?: boolean;
  reportTypeLabel?: string;
}

interface PdfOptions {
  projectName: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  technicalResponsible?: string;
  entries: DiaryEntry[];
  userName?: string;
  includePhotos?: boolean;
  aiSummary?: string | null;
  contentFilters?: PdfContentFilters;
  logoBase64?: string | null;
  brandColor?: string;
}

// Helper to convert hex to RGB tuple
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// ── Helpers ──

function fmtDate(d: string) {
  try {
    return format(new Date(d + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return d;
  }
}

function fmtDateShort(d: string) {
  try {
    return format(new Date(d + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return d;
  }
}

async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateQRDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 120, margin: 1 });
}

async function fetchPhotosForEntry(entryId: string, companyId: string): Promise<DiaryPhoto[]> {
  const { data } = await supabase
    .from("diary_photos")
    .select("id, storage_path, file_name, description, activity, captured_at, latitude, longitude")
    .eq("diary_entry_id", entryId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  return (data || []) as DiaryPhoto[];
}

function getPhotoUrl(path: string) {
  const { data } = supabase.storage.from("diary-photos").getPublicUrl(path);
  return data.publicUrl;
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
  } catch {
    return null;
  }
}

// ── Main generator ──

export async function generateDiaryPDF(
  options: PdfOptions,
  companyId: string,
  onProgress?: (step: string) => void
): Promise<void> {
  const { projectName, companyName, companyAddress, companyPhone, technicalResponsible, entries, userName, includePhotos = true, aiSummary, contentFilters, logoBase64, brandColor } = options;
  const BC = brandColor ? hexToRgb(brandColor) : BLUE;
  const showActivities = contentFilters?.includeActivities ?? true;
  const showOccurrences = contentFilters?.includeOccurrences ?? true;
  const showMaterials = contentFilters?.includeMaterials ?? true;
  const showTechnical = contentFilters?.includeTechnicalComments ?? true;
  const reportTypeLabel = contentFilters?.reportTypeLabel || "Personalizado";
  const doc = new jsPDF();
  const now = new Date();
  const generatedAt = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const reportId = `RDO-${format(now, "yyyyMMddHHmmss")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // Build content string for hash
  const contentForHash = JSON.stringify({
    reportId,
    projectName,
    generatedAt: now.toISOString(),
    entriesCount: entries.length,
    entryIds: entries.map((e) => e.id),
  });
  onProgress?.("Calculando hash de integridade...");
  const integrityHash = await computeHash(contentForHash);
  const shortHash = integrityHash.substring(0, 16).toUpperCase();

  // QR Code
  onProgress?.("Gerando QR Code...");
  const qrContent = JSON.stringify({
    id: reportId,
    hash: shortHash,
    project: projectName,
    entries: entries.length,
    generated: now.toISOString(),
  });
  const qrDataUrl = await generateQRDataUrl(qrContent);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ═══════════════════════════════════════
  // PAGE 1: COVER
  // ═══════════════════════════════════════
  onProgress?.("Gerando capa...");

  // Background accent bar
  doc.setFillColor(BC[0], BC[1], BC[2]);
  doc.rect(0, 0, pageW, 8, "F");
  doc.rect(0, pageH - 8, pageW, 8, "F");

  // Company logo
  let titleStartY = 50;
  if (logoBase64) {
    try {
      const logoW = 50;
      const logoH = 25;
      doc.addImage(logoBase64, "PNG", (pageW - logoW) / 2, 16, logoW, logoH);
      titleStartY = 50;
    } catch {
      // skip if logo fails
    }
  }

  // Title
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BC[0], BC[1], BC[2]);
  doc.text("RELATÓRIO", pageW / 2, 50, { align: "center" });
  doc.text("DIÁRIO DE OBRA", pageW / 2, 62, { align: "center" });

  // Divider
  doc.setDrawColor(BC[0], BC[1], BC[2]);
  doc.setLineWidth(0.8);
  doc.line(60, 70, pageW - 60, 70);

  // Project name
  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  doc.text(projectName, pageW / 2, 84, { align: "center" });

  if (companyName) {
    doc.setFontSize(11);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text(companyName, pageW / 2, 93, { align: "center" });
  }

  // Company details below name
  let detailY = companyName ? 100 : 93;
  doc.setFontSize(8);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  if (companyAddress) {
    doc.text(companyAddress, pageW / 2, detailY, { align: "center" });
    detailY += 5;
  }
  if (companyPhone) {
    doc.text(`Tel: ${companyPhone}`, pageW / 2, detailY, { align: "center" });
    detailY += 5;
  }
  if (technicalResponsible) {
    doc.text(`Resp. Técnico: ${technicalResponsible}`, pageW / 2, detailY, { align: "center" });
  }

  // Metadata box
  const boxY = 110;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(30, boxY, pageW - 60, 50, 3, 3, "F");

  doc.setFontSize(9);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  const meta = [
    [`Nº do Relatório: ${reportId}`],
    [`Data de Geração: ${generatedAt}`],
    [`Gerado por: ${userName || "Sistema"}`],
    [`Total de Registros: ${entries.length}`],
    [`Período: ${entries.length > 0 ? `${fmtDateShort(entries[entries.length - 1].entry_date)} a ${fmtDateShort(entries[0].entry_date)}` : "—"}`],
    [`Tipo de Relatório: ${reportTypeLabel}`],
  ];
  meta.forEach((line, i) => {
    doc.text(line[0], 38, boxY + 10 + i * 8);
  });

  // QR Code on cover
  doc.addImage(qrDataUrl, "PNG", pageW - 70, boxY + 2, 30, 30);
  doc.setFontSize(6);
  doc.text("Verificação", pageW - 55, boxY + 35, { align: "center" });

  // Hash footer
  doc.setFontSize(7);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text(`Hash de Integridade (SHA-256): ${shortHash}`, pageW / 2, boxY + 46, { align: "center" });

  // Disclaimer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Este documento foi gerado automaticamente pelo sistema Canteiro Inteli.",
    pageW / 2,
    pageH - 20,
    { align: "center" }
  );

  // ═══════════════════════════════════════
  // PAGE 2: TABLE OF CONTENTS (SUMÁRIO)
  // ═══════════════════════════════════════
  onProgress?.("Gerando sumário...");
  doc.addPage();

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BC[0], BC[1], BC[2]);
  doc.text("Sumário", 14, 24);

  doc.setDrawColor(BC[0], BC[1], BC[2]);
  doc.setLineWidth(0.5);
  doc.line(14, 28, 60, 28);

  const tocItems: string[] = [];
  tocItems.push("1. Resumo Estatístico");
  if (aiSummary) tocItems.push("2. Resumo Executivo (IA)");
  const regIdx = aiSummary ? 3 : 2;
  tocItems.push(`${regIdx}. Registros Cronológicos`);
  if (includePhotos) tocItems.push(`${regIdx + 1}. Registro Fotográfico`);
  tocItems.push(`${regIdx + (includePhotos ? 2 : 1)}. Informações de Verificação`);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  tocItems.forEach((item, i) => {
    doc.text(item, 20, 40 + i * 10);
  });

  // ═══════════════════════════════════════
  // SECTION: SUMMARY STATS
  // ═══════════════════════════════════════
  onProgress?.("Gerando resumo estatístico...");
  doc.addPage();
  addSectionHeader(doc, "1. Resumo Estatístico", 24, BC);

  const weatherCount: Record<string, number> = {};
  let totalTeam = 0;
  let daysWithOccurrences = 0;
  entries.forEach((e) => {
    if (e.weather) weatherCount[e.weather] = (weatherCount[e.weather] || 0) + 1;
    totalTeam += e.team_count || 0;
    if (e.occurrences) daysWithOccurrences++;
  });
  const avgTeam = entries.length > 0 ? Math.round(totalTeam / entries.length) : 0;

  autoTable(doc, {
    startY: 38,
    head: [["Indicador", "Valor"]],
    body: [
      ["Total de registros", String(entries.length)],
      ["Média de equipe/dia", String(avgTeam)],
      ["Dias com ocorrências", String(daysWithOccurrences)],
      ...Object.entries(weatherCount).map(([w, c]) => [
        `Clima: ${weatherLabels[w] || w}`,
        `${c} dia(s)`,
      ]),
    ],
    theme: "grid",
    headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
    styles: { fontSize: 9 },
  });

  // ═══════════════════════════════════════
  // SECTION: AI SUMMARY (optional)
  // ═══════════════════════════════════════
  let sectionNum = 2;
  if (aiSummary) {
    onProgress?.("Adicionando resumo IA...");
    const lastY = (doc as any).lastAutoTable?.finalY ?? 80;
    if (lastY > pageH - 60) doc.addPage();

    const startY = lastY > pageH - 60 ? 20 : lastY + 14;
    addSectionHeader(doc, `${sectionNum}. Resumo Executivo (IA)`, startY, BC);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(aiSummary, pageW - 32);
    doc.text(lines, 16, startY + 16);
    sectionNum++;
  }

  // ═══════════════════════════════════════
  // SECTION: CHRONOLOGICAL ENTRIES
  // ═══════════════════════════════════════
  onProgress?.("Gerando registros cronológicos...");
  doc.addPage();
  addSectionHeader(doc, `${sectionNum}. Registros Cronológicos`, 24, BC);

  autoTable(doc, {
    startY: 38,
    head: [["Data", "Clima", "Equipe", ...(showActivities ? ["Atividades"] : []), ...(showOccurrences ? ["Ocorrências"] : []), ...(showMaterials ? ["Materiais"] : [])]],
    body: entries.map((e) => [
      fmtDateShort(e.entry_date),
      weatherLabels[e.weather || ""] || e.weather || "—",
      String(e.team_count ?? 0),
      ...(showActivities ? [(e.activities || "—").substring(0, 120)] : []),
      ...(showOccurrences ? [(e.occurrences || "—").substring(0, 80)] : []),
      ...(showMaterials ? [(e.materials || "—").substring(0, 80)] : []),
    ]),
    theme: "grid",
    headStyles: { fillColor: [BC[0], BC[1], BC[2]] },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: { 3: { cellWidth: 45 }, 4: { cellWidth: 30 }, 5: { cellWidth: 30 } },
  });

  // Detailed entries
  for (const entry of entries) {
    doc.addPage();
    doc.setFillColor(BC[0], BC[1], BC[2]);
    doc.rect(0, 0, pageW, 4, "F");

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BC[0], BC[1], BC[2]);
    doc.text(fmtDate(entry.entry_date), 14, 18);

    // Metadata row
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    const metaLine = [
      entry.weather ? `Clima: ${weatherLabels[entry.weather] || entry.weather}` : null,
      `Equipe: ${entry.team_count ?? 0} pessoas`,
      entry.is_locked ? "🔒 Bloqueado" : null,
    ]
      .filter(Boolean)
      .join("  |  ");
    doc.text(metaLine, 14, 24);

    let y = 32;
    const sections = [
      ...(showActivities ? [{ label: "Atividades Realizadas", value: entry.activities }] : []),
      ...(showOccurrences ? [{ label: "Ocorrências", value: entry.occurrences }] : []),
      ...(showMaterials ? [{ label: "Materiais Utilizados", value: entry.materials }] : []),
      ...(showTechnical ? [{ label: "Comentários Técnicos", value: entry.technical_comments }] : []),
    ];

    for (const s of sections) {
      if (!s.value) continue;
      if (y > pageH - 30) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(s.label, 14, y);
      y += 5;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(s.value, pageW - 28);
      doc.text(lines, 14, y);
      y += lines.length * 4.5 + 4;
    }
  }

  sectionNum++;

  // ═══════════════════════════════════════
  // SECTION: PHOTOS
  // ═══════════════════════════════════════
  if (includePhotos) {
    onProgress?.("Carregando fotos...");
    doc.addPage();
    addSectionHeader(doc, `${sectionNum}. Registro Fotográfico`, 24, BC);

    let photoY = 38;
    let hasPhotos = false;

    for (const entry of entries) {
      const photos = await fetchPhotosForEntry(entry.id, companyId);
      if (photos.length === 0) continue;
      hasPhotos = true;

      // Entry date header
      if (photoY > pageH - 60) {
        doc.addPage();
        photoY = 20;
      }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(BC[0], BC[1], BC[2]);
      doc.text(fmtDate(entry.entry_date), 14, photoY);
      photoY += 6;

      for (const photo of photos) {
        if (photoY > pageH - 80) {
          doc.addPage();
          photoY = 20;
        }

        const url = getPhotoUrl(photo.storage_path);
        const base64 = await loadImageAsBase64(url);

        if (base64) {
          try {
            const imgW = 80;
            const imgH = 60;
            doc.addImage(base64, "JPEG", 14, photoY, imgW, imgH);

            // Caption beside image
            const captionX = 100;
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(40, 40, 40);
            doc.text(photo.file_name, captionX, photoY + 6);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
            let cY = photoY + 12;

            if (photo.description) {
              const descLines = doc.splitTextToSize(photo.description, pageW - captionX - 14);
              doc.text(descLines, captionX, cY);
              cY += descLines.length * 4 + 2;
            }
            if (photo.activity) {
              doc.text(`Atividade: ${photo.activity}`, captionX, cY);
              cY += 5;
            }
            if (photo.captured_at) {
              doc.text(
                `Captura: ${format(new Date(photo.captured_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
                captionX,
                cY
              );
              cY += 5;
            }
            if (photo.latitude && photo.longitude) {
              doc.text(`GPS: ${photo.latitude.toFixed(5)}, ${photo.longitude.toFixed(5)}`, captionX, cY);
            }

            photoY += imgH + 8;
          } catch {
            // skip unreadable image
          }
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
  // LAST PAGE: VERIFICATION INFO
  // ═══════════════════════════════════════
  onProgress?.("Finalizando documento...");
  doc.addPage();
  addSectionHeader(doc, `${sectionNum}. Informações de Verificação`, 24, BC);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);

  const verifyInfo = [
    `Nº do Relatório: ${reportId}`,
    `Hash SHA-256: ${integrityHash}`,
    `Hash Resumido: ${shortHash}`,
    `Data/Hora de Geração: ${now.toISOString()}`,
    `Gerado por: ${userName || "Sistema"}`,
    `Obra: ${projectName}`,
    `Total de Registros: ${entries.length}`,
  ];
  verifyInfo.forEach((line, i) => {
    doc.text(line, 14, 40 + i * 7);
  });

  // QR Code
  doc.addImage(qrDataUrl, "PNG", 14, 96, 40, 40);
  doc.setFontSize(7);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text("Escaneie o QR Code para verificar a autenticidade deste relatório.", 14, 142);
  doc.text("O código contém o identificador único e o hash de integridade do documento.", 14, 147);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`${reportId}  |  Hash: ${shortHash}`, 14, pageH - 6);
    doc.text(`Página ${i} de ${totalPages}`, pageW - 14, pageH - 6, { align: "right" });
  }

  // Save
  const fileName = `RDO-${projectName.replace(/\s+/g, "-").toLowerCase()}-${format(now, "yyyy-MM-dd")}.pdf`;
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
