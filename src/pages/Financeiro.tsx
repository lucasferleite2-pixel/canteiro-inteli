import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, Plus, Trash2, FileDown,
  ClipboardList, AlertTriangle, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DemoBanner } from "@/components/DemoBanner";
import { DEMO_FINANCIAL_RECORDS, DEMO_OBRAS, DEMO_DESPESAS, DEMO_RDO_ENTRIES } from "@/lib/demoData";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate } from "react-router-dom";

type FinancialRecord = {
  id: string;
  description: string;
  amount: number;
  type: string;
  category: string | null;
  due_date: string | null;
  paid_at: string | null;
  project_id: string | null;
  contract_id: string | null;
  company_id: string;
  created_at: string;
  origem?: string;
  rdo_despesa_item_id?: string | null;
  centro_custo?: string | null;
  previsto_no_orcamento?: boolean;
};

type Project = {
  id: string;
  name: string;
  budget: number | null;
};

const currencyFmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Financeiro() {
  const { companyId, isDemo } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterOrigem, setFilterOrigem] = useState<string>("all");
  const [filterCentroCusto, setFilterCentroCusto] = useState<string>("all");
  const [filterNaoPrevista, setFilterNaoPrevista] = useState(false);

  // Form state
  const [form, setForm] = useState({
    description: "",
    amount: "",
    type: "expense",
    category: "",
    due_date: "",
    project_id: "",
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects", companyId],
    enabled: !!companyId || isDemo,
    queryFn: async () => {
      if (isDemo) return DEMO_OBRAS.map((o) => ({ id: o.id, name: o.name, budget: o.budget }));
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, budget")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Build demo financial records with RDO-linked entries
  const demoRecordsWithRdo = useMemo(() => {
    if (!isDemo) return [];
    const base = DEMO_FINANCIAL_RECORDS.map((r) => ({ ...r, origem: "manual" as const }));
    const rdoLinked = DEMO_DESPESAS.filter((d) => d.afeta_curva_financeira).map((d) => {
      const rdo = DEMO_RDO_ENTRIES.find((r) => r.id === d.rdo_dia_id);
      const tipoLabels: Record<string, string> = {
        material: "Material", mao_de_obra: "Mão de Obra",
        equipamento: "Equipamento", transporte: "Transporte", outro: "Outro",
      };
      return {
        id: `fin-rdo-${d.id}`,
        description: d.descricao,
        amount: d.valor_total,
        type: "expense",
        category: tipoLabels[d.tipo] || d.tipo,
        due_date: rdo ? rdo.data : null,
        paid_at: null,
        project_id: rdo?.obra_id || null,
        company_id: d.company_id,
        created_at: d.created_at,
        origem: "rdo",
        rdo_despesa_item_id: d.id,
        centro_custo: d.centro_custo,
        previsto_no_orcamento: d.previsto_no_orcamento,
      };
    });
    return [...base, ...rdoLinked] as FinancialRecord[];
  }, [isDemo]);

  const { data: records = [], isLoading } = useQuery<FinancialRecord[]>({
    queryKey: ["financial_records", companyId],
    enabled: !!companyId || isDemo,
    queryFn: async () => {
      if (isDemo) return demoRecordsWithRdo;
      const { data, error } = await supabase
        .from("financial_records")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("financial_records").insert({
        company_id: companyId!,
        description: form.description,
        amount: parseFloat(form.amount),
        type: form.type,
        category: form.category || null,
        due_date: form.due_date || null,
        project_id: form.project_id || null,
        origem: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_records"] });
      setDialogOpen(false);
      setForm({ description: "", amount: "", type: "expense", category: "", due_date: "", project_id: "" });
      toast.success("Lançamento criado com sucesso!");
    },
    onError: () => toast.error("Erro ao criar lançamento."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (record: FinancialRecord) => {
      if (record.origem === "rdo") {
        throw new Error("Lançamentos originados do RDO não podem ser excluídos diretamente. Remova a despesa no Diário de Obra.");
      }
      const { error } = await supabase.from("financial_records").delete().eq("id", record.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_records"] });
      toast.success("Lançamento removido.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_records")
        .update({ paid_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_records"] });
      toast.success("Marcado como pago.");
    },
  });

  // Collect unique centros de custo
  const centrosCusto = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => { if (r.centro_custo) set.add(r.centro_custo); });
    return Array.from(set).sort();
  }, [records]);

  // Apply all filters
  const filtered = useMemo(() => {
    let result = records;
    if (filterProject !== "all") result = result.filter((r) => r.project_id === filterProject);
    if (filterOrigem !== "all") result = result.filter((r) => (r.origem || "manual") === filterOrigem);
    if (filterCentroCusto !== "all") result = result.filter((r) => r.centro_custo === filterCentroCusto);
    if (filterNaoPrevista) result = result.filter((r) => r.previsto_no_orcamento === false);
    return result;
  }, [records, filterProject, filterOrigem, filterCentroCusto, filterNaoPrevista]);

  // Stats
  const totalReceitas = filtered.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const totalDespesas = filtered.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  const totalPago = filtered.filter((r) => r.paid_at).reduce((s, r) => s + (r.type === "expense" ? -r.amount : r.amount), 0);
  const aPagar = filtered.filter((r) => r.type === "expense" && !r.paid_at).reduce((s, r) => s + r.amount, 0);

  // RDO integration stats
  const rdoStats = useMemo(() => {
    const allExpenses = records.filter((r) => r.type === "expense");
    const rdoRecords = allExpenses.filter((r) => r.origem === "rdo");
    const manualRecords = allExpenses.filter((r) => (r.origem || "manual") === "manual");
    const totalRdo = rdoRecords.reduce((s, r) => s + r.amount, 0);
    const totalManual = manualRecords.reduce((s, r) => s + r.amount, 0);
    const totalAll = totalRdo + totalManual;
    const naoPrevistas = rdoRecords.filter((r) => r.previsto_no_orcamento === false);
    const totalNaoPrevisto = naoPrevistas.reduce((s, r) => s + r.amount, 0);
    const pctRdo = totalAll > 0 ? (totalRdo / totalAll) * 100 : 0;
    const pctNaoPrevisto = totalAll > 0 ? (totalNaoPrevisto / totalAll) * 100 : 0;

    // By centro de custo
    const byCentro: Record<string, number> = {};
    rdoRecords.forEach((r) => {
      const cc = r.centro_custo || "Sem centro";
      byCentro[cc] = (byCentro[cc] || 0) + r.amount;
    });

    return { totalRdo, totalManual, pctRdo, totalNaoPrevisto, pctNaoPrevisto, rdoCount: rdoRecords.length, byCentro };
  }, [records]);

  // Budget vs Actual chart
  const budgetVsActual = useMemo(() => {
    return projects.map((p) => {
      const projectRecords = records.filter((r) => r.project_id === p.id && r.type === "expense");
      const realizado = projectRecords.reduce((s, r) => s + r.amount, 0);
      const overBudget = (p.budget ?? 0) > 0 && realizado > (p.budget ?? 0);
      return { name: p.name.substring(0, 20), orcamento: p.budget ?? 0, realizado, overBudget };
    });
  }, [projects, records]);

  // Cash flow by month
  const cashFlow = useMemo(() => {
    const months: Record<string, { receitas: number; despesas: number }> = {};
    filtered.forEach((r) => {
      const month = r.due_date
        ? format(new Date(r.due_date), "MMM/yy", { locale: ptBR })
        : format(new Date(r.created_at), "MMM/yy", { locale: ptBR });
      if (!months[month]) months[month] = { receitas: 0, despesas: 0 };
      if (r.type === "income") months[month].receitas += r.amount;
      else months[month].despesas += r.amount;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, receitas: v.receitas, despesas: v.despesas, saldo: v.receitas - v.despesas }));
  }, [filtered]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const now = format(new Date(), "dd/MM/yyyy HH:mm");
    const projectName = filterProject === "all"
      ? "Todas as obras"
      : projects.find((p) => p.id === filterProject)?.name ?? "";

    doc.setFontSize(18);
    doc.text("Relatório Financeiro", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${now}`, 14, 28);
    doc.text(`Filtro: ${projectName}`, 14, 34);

    doc.setFontSize(13);
    doc.text("Resumo", 14, 46);
    autoTable(doc, {
      startY: 50,
      head: [["Indicador", "Valor"]],
      body: [
        ["Receitas", currencyFmt(totalReceitas)],
        ["Despesas", currencyFmt(totalDespesas)],
        ["A Pagar", currencyFmt(aPagar)],
        ["Saldo Pago", currencyFmt(totalPago)],
        ["Despesas via RDO", currencyFmt(rdoStats.totalRdo)],
        ["Despesas manuais", currencyFmt(rdoStats.totalManual)],
        ["% Custo operacional (RDO)", `${rdoStats.pctRdo.toFixed(1)}%`],
        ["Despesas não previstas", currencyFmt(rdoStats.totalNaoPrevisto)],
      ],
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
    });

    const y1 = (doc as any).lastAutoTable?.finalY ?? 80;
    if (budgetVsActual.length > 0) {
      doc.setFontSize(13);
      doc.text("Orçado vs Realizado", 14, y1 + 12);
      autoTable(doc, {
        startY: y1 + 16,
        head: [["Obra", "Orçamento", "Realizado", "Diferença"]],
        body: budgetVsActual.map((r) => [
          r.name, currencyFmt(r.orcamento), currencyFmt(r.realizado), currencyFmt(r.orcamento - r.realizado),
        ]),
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    const y2 = (doc as any).lastAutoTable?.finalY ?? y1 + 20;
    if (cashFlow.length > 0) {
      doc.setFontSize(13);
      doc.text("Fluxo de Caixa", 14, y2 + 12);
      autoTable(doc, {
        startY: y2 + 16,
        head: [["Mês", "Receitas", "Despesas", "Saldo"]],
        body: cashFlow.map((r) => [r.month, currencyFmt(r.receitas), currencyFmt(r.despesas), currencyFmt(r.saldo)]),
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    const y3 = (doc as any).lastAutoTable?.finalY ?? y2 + 20;
    if (filtered.length > 0) {
      doc.addPage();
      doc.setFontSize(13);
      doc.text("Lançamentos", 14, 20);
      autoTable(doc, {
        startY: 24,
        head: [["Descrição", "Tipo", "Categoria", "Valor", "Origem", "Status"]],
        body: filtered.map((r) => [
          r.description,
          r.type === "income" ? "Receita" : "Despesa",
          r.category || "—",
          currencyFmt(r.amount),
          (r.origem || "manual") === "rdo" ? "RDO" : "Manual",
          r.paid_at ? "Pago" : "Pendente",
        ]),
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
      });
    }

    doc.save(`relatorio-financeiro-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF exportado com sucesso!");
  };

  const navigateToRdo = () => {
    navigate(isDemo ? "/diario?demo=true" : "/diario");
  };

  const stats = [
    { label: "Receitas", value: currencyFmt(totalReceitas), icon: TrendingUp, color: "text-emerald-500" },
    { label: "Despesas", value: currencyFmt(totalDespesas), icon: TrendingDown, color: "text-destructive" },
    { label: "A Pagar", value: currencyFmt(aPagar), icon: Wallet, color: "text-orange-500" },
    { label: "Saldo Pago", value: currencyFmt(totalPago), icon: DollarSign, color: "text-primary" },
  ];

  const chartConfig = {
    orcamento: { label: "Orçamento", color: "hsl(var(--primary))" },
    realizado: { label: "Realizado", color: "hsl(var(--destructive))" },
  };

  const flowConfig = {
    receitas: { label: "Receitas", color: "hsl(142 71% 45%)" },
    despesas: { label: "Despesas", color: "hsl(var(--destructive))" },
    saldo: { label: "Saldo", color: "hsl(var(--primary))" },
  };

  return (
    <div className="space-y-6">
      <DemoBanner />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground">Controle financeiro integrado por obra.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={exportPDF}>
            <FileDown className="h-4 w-4 mr-2" /> Exportar PDF
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Lançamento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Lançamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Categoria</Label>
                    <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Material, Mão de obra..." />
                  </div>
                  <div>
                    <Label>Vencimento</Label>
                    <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Obra</Label>
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" disabled={!form.description || !form.amount} onClick={() => createMutation.mutate()}>
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Obra" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as obras</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterOrigem} onValueChange={setFilterOrigem}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="rdo">RDO</SelectItem>
          </SelectContent>
        </Select>

        {centrosCusto.length > 0 && (
          <Select value={filterCentroCusto} onValueChange={setFilterCentroCusto}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Centro de custo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos centros</SelectItem>
              {centrosCusto.map((cc) => (
                <SelectItem key={cc} value={cc}>{cc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          variant={filterNaoPrevista ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterNaoPrevista(!filterNaoPrevista)}
          className="gap-1"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Não previstas
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* RDO Integration Cards */}
      {rdoStats.rdoCount > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Despesas via RDO</CardTitle>
              <ClipboardList className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{currencyFmt(rdoStats.totalRdo)}</p>
              <p className="text-xs text-muted-foreground">{rdoStats.rdoCount} lançamentos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Despesas Manuais</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{currencyFmt(rdoStats.totalManual)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">% Custo via Diário</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{rdoStats.pctRdo.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className={rdoStats.pctNaoPrevisto > 5 ? "border-destructive/30 bg-destructive/5" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Não Previstas</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${rdoStats.pctNaoPrevisto > 5 ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{currencyFmt(rdoStats.totalNaoPrevisto)}</p>
              <p className="text-xs text-muted-foreground">{rdoStats.pctNaoPrevisto.toFixed(1)}% do total</p>
              {rdoStats.pctNaoPrevisto > 5 && (
                <p className="text-xs text-destructive mt-1 font-medium">⚠ Possível desequilíbrio financeiro</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Orçado vs Realizado</CardTitle>
          </CardHeader>
          <CardContent>
            {budgetVsActual.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <BarChart data={budgetVsActual}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="orcamento" fill="var(--color-orcamento)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="realizado" fill="var(--color-realizado)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Cadastre obras com orçamento para visualizar.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fluxo de Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            {cashFlow.length > 0 ? (
              <ChartContainer config={flowConfig} className="h-[260px] w-full">
                <LineChart data={cashFlow}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="receitas" stroke="var(--color-receitas)" strokeWidth={2} />
                  <Line type="monotone" dataKey="despesas" stroke="var(--color-despesas)" strokeWidth={2} />
                  <Line type="monotone" dataKey="saldo" stroke="var(--color-saldo)" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Dados disponíveis após lançamentos financeiros.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const isRdo = (r.origem || "manual") === "rdo";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            {r.previsto_no_orcamento === false && (
                              <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                            )}
                            {r.description}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.type === "income" ? "default" : "destructive"}>
                            {r.type === "income" ? "Receita" : "Despesa"}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.category || "—"}</TableCell>
                        <TableCell>
                          {isRdo ? (
                            <Badge variant="outline" className="gap-1 text-xs border-primary/40 text-primary">
                              <ClipboardList className="h-3 w-3" /> RDO
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Manual</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{currencyFmt(r.amount)}</TableCell>
                        <TableCell>{r.due_date ? format(new Date(r.due_date), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell>
                          {r.paid_at ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-600">Pago</Badge>
                          ) : !isDemo ? (
                            <Button variant="ghost" size="sm" onClick={() => markPaidMutation.mutate(r.id)}>
                              Marcar pago
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pendente</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isRdo && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={navigateToRdo} title="Ver origem no RDO">
                                <ExternalLink className="h-3.5 w-3.5 text-primary" />
                              </Button>
                            )}
                            {!isRdo && !isDemo && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(r)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
