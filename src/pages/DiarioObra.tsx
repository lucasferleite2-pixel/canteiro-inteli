import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, ClipboardList, Loader2, Sparkles, FileDown, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_OBRAS, DEMO_RDO_ENTRIES, DEMO_DESPESAS } from "@/lib/demoData";
import { DiaryPdfFilterDialog, PdfFilters } from "@/components/diary/DiaryPdfFilterDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import { AIAnalysisPanel } from "@/components/AIAnalysisPanel";
import { generateDiaryPDF, PdfContentFilters } from "@/lib/diaryPdfGenerator";
import { generateRdoPDF } from "@/lib/rdoPdfGenerator";
import { RdoSmartCard } from "@/components/rdo/RdoSmartCard";
import { RdoFilters, RdoFilterValues, defaultFilters } from "@/components/rdo/RdoFilters";
import { RdoNewDayDialog } from "@/components/rdo/RdoNewDayDialog";
import { RdoDashboard } from "@/components/rdo/RdoDashboard";
import { DemoBanner } from "@/components/DemoBanner";
import { NcReportDialog } from "@/components/rdo/NcReportDialog";

export default function DiarioObra() {
  const { companyId, user, isDemo } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState("");
  const [showNewRdo, setShowNewRdo] = useState(false);
  const [editingRdo, setEditingRdo] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showPdfFilter, setShowPdfFilter] = useState(false);
  const [showNcReport, setShowNcReport] = useState(false);
  const [filters, setFilters] = useState<RdoFilterValues>(defaultFilters);
  const ai = useAIAnalysis();

  // Projects
  const { data: projects = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase.from("projects").select("id, name, status, address, municipality").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !isDemo,
  });

  const resolvedProjects = isDemo
    ? DEMO_OBRAS.filter((o) => o.status === "in_progress").map((o) => ({ id: o.id, name: o.name, status: o.status }))
    : projects;

  // Contracts (for PDF dialog)
  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts", companyId, selectedProject],
    queryFn: async () => {
      if (!companyId) return [];
      let q = supabase.from("contracts").select("id, name").eq("company_id", companyId);
      if (selectedProject) q = q.eq("project_id", selectedProject);
      const { data, error } = await q.order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // RDO entries (new system)
  const { data: rdos = [], isLoading } = useQuery({
    queryKey: ["rdo_dia", companyId, selectedProject],
    queryFn: async () => {
      if (!companyId || !selectedProject) return [];
      const { data, error } = await supabase
        .from("rdo_dia")
        .select("*")
        .eq("company_id", companyId)
        .eq("obra_id", selectedProject)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!selectedProject && !isDemo,
  });

  const resolvedRdos = isDemo
    ? DEMO_RDO_ENTRIES.filter((r) => r.obra_id === selectedProject)
    : rdos;

  // Despesas for corrective actions
  const { data: despesasData = [] } = useQuery({
    queryKey: ["rdo_despesa_item_ca", companyId, selectedProject],
    queryFn: async () => {
      if (!companyId || !selectedProject) return [];
      const rdoIds = resolvedRdos.map((r: any) => r.id);
      if (!rdoIds.length) return [];
      const { data, error } = await supabase
        .from("rdo_despesa_item")
        .select("*")
        .eq("company_id", companyId)
        .in("rdo_dia_id", rdoIds);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!selectedProject && !isDemo && resolvedRdos.length > 0,
  });

  const resolvedDespesas = isDemo
    ? DEMO_DESPESAS.filter((d) => resolvedRdos.some((r: any) => r.id === d.rdo_dia_id))
    : despesasData;

  const selectedObraOrcamento = isDemo
    ? DEMO_OBRAS.find((o) => o.id === selectedProject)?.budget
    : undefined;

  // Legacy entries (for backward compat & PDF)
  const { data: legacyEntries = [] } = useQuery({
    queryKey: ["diary_entries", companyId, selectedProject],
    queryFn: async () => {
      if (!companyId || !selectedProject) return [];
      const { data, error } = await supabase
        .from("diary_entries")
        .select("*, projects(name)")
        .eq("company_id", companyId)
        .eq("project_id", selectedProject)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!selectedProject,
  });

  // Apply filters
  const filteredRdos = resolvedRdos.filter((r: any) => {
    if (filters.dateFrom && r.data < filters.dateFrom.toISOString().split("T")[0]) return false;
    if (filters.dateTo && r.data > filters.dateTo.toISOString().split("T")[0]) return false;
    if (filters.fase && r.fase_obra !== filters.fase) return false;
    if (filters.risco && r.risco_dia !== filters.risco) return false;
    return true;
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rdo_dia").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rdo_dia"] });
      setDeleteId(null);
      toast({ title: "RDO excluído com sucesso!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const handleAISummary = () => {
    const projectName = resolvedProjects.find((p) => p.id === selectedProject)?.name || "Obra";
    // Combine RDO + legacy for AI summary
    const entries = legacyEntries;
    if (entries.length === 0 && resolvedRdos.length === 0) {
      toast({ variant: "destructive", title: "Sem registros", description: "Adicione registros antes de gerar o resumo." });
      return;
    }
    ai.analyze("diary_summary", { projectName, entries });
  };

  // PDF export
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");

  const reportTypeLabels: Record<string, string> = {
    custom: "Personalizado", weekly: "Semanal", biweekly: "Quinzenal",
    monthly: "Mensal", quarterly: "Trimestral", semiannual: "Semestral", annual: "Anual",
  };

  const exportPDF = async (pdfFilters: PdfFilters) => {
    // Use RDO 2.0 generator if we have structured data
    const hasRdoData = filteredRdos.length > 0;
    if (!hasRdoData && legacyEntries.length === 0) return;

    setPdfLoading(true);
    setPdfProgress("Iniciando...");
    try {
      if (hasRdoData) {
        // RDO 2.0 PDF with structured data, charts, and risk indicators
        let rdosForPdf = [...filteredRdos];
        if (pdfFilters.dateFrom) {
          const fromStr = pdfFilters.dateFrom.toISOString().split("T")[0];
          rdosForPdf = rdosForPdf.filter((r: any) => r.data >= fromStr);
        }
        if (pdfFilters.dateTo) {
          const toStr = pdfFilters.dateTo.toISOString().split("T")[0];
          rdosForPdf = rdosForPdf.filter((r: any) => r.data <= toStr);
        }
        if (rdosForPdf.length === 0) {
          toast({ variant: "destructive", title: "Sem registros", description: "Nenhum RDO encontrado para os filtros selecionados." });
          return;
        }

        await supabase.from("companies").update({
          address: pdfFilters.companyAddress || null,
          phone: pdfFilters.companyPhone || null,
          technical_responsible: pdfFilters.technicalResponsible || null,
          brand_color: pdfFilters.brandColor || null,
        } as any).eq("id", companyId!);

        await generateRdoPDF(
          {
            projectName: resolvedProjects.find((p) => p.id === selectedProject)?.name || "Obra",
            municipality: (resolvedProjects.find((p) => p.id === selectedProject) as any)?.address || undefined,
            companyName: pdfFilters.companyName || undefined,
            companyAddress: pdfFilters.companyAddress || undefined,
            companyPhone: pdfFilters.companyPhone || undefined,
            technicalResponsible: pdfFilters.technicalResponsible || undefined,
            rdos: rdosForPdf,
            userName: user?.email || undefined,
            aiSummary: ai.result || null,
            logoBase64: pdfFilters.includeLogo ? pdfFilters.logoBase64 : null,
            brandColor: pdfFilters.brandColor,
            includePhotos: pdfFilters.includePhotos,
            includeActivities: pdfFilters.includeActivities,
            includeOccurrences: pdfFilters.includeOccurrences,
            includeMaterials: pdfFilters.includeMaterials,
            includeDespesas: pdfFilters.includeDespesas,
          },
          companyId!,
          (step) => setPdfProgress(step)
        );
      } else {
        // Legacy PDF for old diary_entries
        let filtered = [...legacyEntries];
        if (pdfFilters.dateFrom) {
          const fromStr = pdfFilters.dateFrom.toISOString().split("T")[0];
          filtered = filtered.filter((e) => e.entry_date >= fromStr);
        }
        if (pdfFilters.dateTo) {
          const toStr = pdfFilters.dateTo.toISOString().split("T")[0];
          filtered = filtered.filter((e) => e.entry_date <= toStr);
        }
        if (filtered.length === 0) {
          toast({ variant: "destructive", title: "Sem registros", description: "Nenhum registro encontrado para os filtros selecionados." });
          return;
        }
        const contentFilters: PdfContentFilters = {
          includePhotos: pdfFilters.includePhotos,
          includeActivities: pdfFilters.includeActivities,
          includeOccurrences: pdfFilters.includeOccurrences,
          includeMaterials: pdfFilters.includeMaterials,
          includeTechnicalComments: pdfFilters.includeTechnicalComments,
          reportTypeLabel: reportTypeLabels[pdfFilters.reportType] || "Personalizado",
        };
        await supabase.from("companies").update({
          address: pdfFilters.companyAddress || null,
          phone: pdfFilters.companyPhone || null,
          technical_responsible: pdfFilters.technicalResponsible || null,
          brand_color: pdfFilters.brandColor || null,
        } as any).eq("id", companyId!);
        await generateDiaryPDF(
          {
            projectName: resolvedProjects.find((p) => p.id === selectedProject)?.name || "Obra",
            companyName: pdfFilters.companyName || undefined,
            companyAddress: pdfFilters.companyAddress || undefined,
            companyPhone: pdfFilters.companyPhone || undefined,
            technicalResponsible: pdfFilters.technicalResponsible || undefined,
            entries: filtered,
            userName: user?.email || undefined,
            includePhotos: pdfFilters.includePhotos,
            aiSummary: ai.result || null,
            contentFilters,
            logoBase64: pdfFilters.includeLogo ? pdfFilters.logoBase64 : null,
            brandColor: pdfFilters.brandColor,
          },
          companyId!,
          (step) => setPdfProgress(step)
        );
      }
      toast({ title: "PDF exportado com sucesso!" });
      setShowPdfFilter(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao gerar PDF", description: err.message });
    } finally {
      setPdfLoading(false);
      setPdfProgress("");
    }
  };

  const canModifyRdo = (rdo: any) => !rdo.is_locked && rdo.criado_por === user?.id;

  return (
    <div className="space-y-6">
      <DemoBanner />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diário de Obra</h1>
          <p className="text-muted-foreground text-sm">RDO 2.0 — Registro estruturado com indicadores de gestão.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedProject && (legacyEntries.length > 0 || resolvedRdos.length > 0) && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowPdfFilter(true)} disabled={pdfLoading}>
                {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                {pdfLoading ? pdfProgress : "Exportar PDF"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleAISummary} disabled={ai.isLoading}>
                {ai.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Resumo IA
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowNcReport(true)} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                <ShieldAlert className="mr-2 h-4 w-4" />
                Laudo NC
              </Button>
            </>
          )}
          <Button onClick={() => setShowNewRdo(true)} disabled={!selectedProject}>
            <Plus className="mr-2 h-4 w-4" /> Novo RDO
          </Button>
        </div>
      </div>

      {/* Project selector */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium">Obra:</Label>
        <Select value={selectedProject} onValueChange={(v) => { setSelectedProject(v); ai.clear(); setFilters(defaultFilters); }}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Selecione uma obra" /></SelectTrigger>
          <SelectContent>
            {resolvedProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Filters */}
      {selectedProject && resolvedRdos.length > 0 && (
        <RdoFilters filters={filters} onChange={setFilters} />
      )}

      {/* KPI Dashboard */}
      {selectedProject && filteredRdos.length > 0 && (
        <RdoDashboard rdos={filteredRdos} despesas={resolvedDespesas} obraId={selectedProject} companyId={companyId || undefined} obraOrcamento={selectedObraOrcamento} />
      )}

      {/* New RDO Dialog */}
      {showNewRdo && selectedProject && companyId && (
        <RdoNewDayDialog
          open={showNewRdo}
          onOpenChange={(v) => { setShowNewRdo(v); if (!v) setEditingRdo(null); }}
          obraId={selectedProject}
          companyId={companyId}
          editingRdo={editingRdo}
        />
      )}

      {/* PDF Filter Dialog */}
      <DiaryPdfFilterDialog
        open={showPdfFilter}
        onOpenChange={setShowPdfFilter}
        contracts={contracts}
        onGenerate={exportPDF}
        isLoading={pdfLoading}
        progress={pdfProgress}
      />

      {/* NC Report Dialog */}
      <NcReportDialog
        open={showNcReport}
        onOpenChange={setShowNcReport}
        projectName={resolvedProjects.find((p) => p.id === selectedProject)?.name || "Obra"}
        projectAddress={(resolvedProjects.find((p) => p.id === selectedProject) as any)?.address || ""}
      />

      {/* AI Panel */}
      <AIAnalysisPanel title="Resumo Inteligente do Diário" result={ai.result} isLoading={ai.isLoading} onClose={ai.clear} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir RDO?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O registro e todos os dados associados serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main content */}
      {!selectedProject ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Selecione uma obra</p>
            <p className="text-sm text-muted-foreground/70">Escolha uma obra acima para visualizar ou criar registros diários.</p>
          </CardContent>
        </Card>
      ) : !isDemo && isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filteredRdos.length === 0 && legacyEntries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhum registro de RDO</p>
            <p className="text-sm text-muted-foreground/70 mb-4">Crie o primeiro registro inteligente desta obra.</p>
            <Button variant="outline" onClick={() => setShowNewRdo(true)}>
              <Plus className="mr-2 h-4 w-4" /> Novo RDO
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* RDO 2.0 cards */}
          {filteredRdos.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">RDO 2.0</h2>
                <Badge variant="secondary" className="text-xs">{filteredRdos.length} registros</Badge>
              </div>
              {filteredRdos.map((rdo: any) => (
                <RdoSmartCard
                  key={rdo.id}
                  rdo={rdo}
                  companyId={companyId!}
                  canModify={canModifyRdo(rdo)}
                  isAuthor={rdo.criado_por === user?.id}
                  onEdit={() => { setEditingRdo(rdo); setShowNewRdo(true); }}
                  onDelete={() => setDeleteId(rdo.id)}
                />
              ))}
            </>
          )}

          {/* Legacy entries */}
          {legacyEntries.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-4 border-t">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Registros Legados</h2>
                <Badge variant="outline" className="text-xs">{legacyEntries.length}</Badge>
              </div>
              <div className="space-y-2">
                {legacyEntries.map((entry: any) => (
                  <LegacyEntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Compact legacy entry card
function LegacyEntryCard({ entry }: { entry: any }) {
  const formatDate = (d: string) => {
    try {
      const { format } = require("date-fns");
      const { ptBR } = require("date-fns/locale");
      return format(new Date(d + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
    } catch { return d; }
  };

  return (
    <Card className="bg-muted/30">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{formatDate(entry.entry_date)}</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {entry.weather && <Badge variant="outline" className="text-[10px] h-5">{entry.weather}</Badge>}
            {entry.team_count > 0 && <span>👷 {entry.team_count}</span>}
          </div>
        </div>
        {entry.activities && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.activities}</p>}
      </CardContent>
    </Card>
  );
}
