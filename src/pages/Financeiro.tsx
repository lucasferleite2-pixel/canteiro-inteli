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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer } from "recharts";
import { DollarSign, TrendingUp, TrendingDown, Wallet, Plus, Trash2, FileDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DemoBanner } from "@/components/DemoBanner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
};

type Project = {
  id: string;
  name: string;
  budget: number | null;
};

const currencyFmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Financeiro() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterProject, setFilterProject] = useState<string>("all");

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
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, budget")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: records = [], isLoading } = useQuery<FinancialRecord[]>({
    queryKey: ["financial_records", companyId],
    enabled: !!companyId,
    queryFn: async () => {
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_records"] });
      toast.success("Lançamento removido.");
    },
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

  const filtered = useMemo(
    () => (filterProject === "all" ? records : records.filter((r) => r.project_id === filterProject)),
    [records, filterProject]
  );

  // Stats
  const totalReceitas = filtered.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const totalDespesas = filtered.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  const totalPago = filtered.filter((r) => r.paid_at).reduce((s, r) => s + (r.type === "expense" ? -r.amount : r.amount), 0);
  const aPagar = filtered.filter((r) => r.type === "expense" && !r.paid_at).reduce((s, r) => s + r.amount, 0);

  // Budget vs Actual chart
  const budgetVsActual = useMemo(() => {
    return projects.map((p) => {
      const projectRecords = records.filter((r) => r.project_id === p.id && r.type === "expense");
      const realizado = projectRecords.reduce((s, r) => s + r.amount, 0);
      return { name: p.name.substring(0, 20), orcamento: p.budget ?? 0, realizado };
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

    // Header
    doc.setFontSize(18);
    doc.text("Relatório Financeiro", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${now}`, 14, 28);
    doc.text(`Filtro: ${projectName}`, 14, 34);

    // Summary
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
      ],
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Budget vs Actual table
    const y1 = (doc as any).lastAutoTable?.finalY ?? 80;
    if (budgetVsActual.length > 0) {
      doc.setFontSize(13);
      doc.text("Orçado vs Realizado", 14, y1 + 12);
      autoTable(doc, {
        startY: y1 + 16,
        head: [["Obra", "Orçamento", "Realizado", "Diferença"]],
        body: budgetVsActual.map((r) => [
          r.name,
          currencyFmt(r.orcamento),
          currencyFmt(r.realizado),
          currencyFmt(r.orcamento - r.realizado),
        ]),
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    // Cash flow table
    const y2 = (doc as any).lastAutoTable?.finalY ?? y1 + 20;
    if (cashFlow.length > 0) {
      doc.setFontSize(13);
      doc.text("Fluxo de Caixa", 14, y2 + 12);
      autoTable(doc, {
        startY: y2 + 16,
        head: [["Mês", "Receitas", "Despesas", "Saldo"]],
        body: cashFlow.map((r) => [
          r.month,
          currencyFmt(r.receitas),
          currencyFmt(r.despesas),
          currencyFmt(r.saldo),
        ]),
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    // Records table
    const y3 = (doc as any).lastAutoTable?.finalY ?? y2 + 20;
    if (filtered.length > 0) {
      doc.addPage();
      doc.setFontSize(13);
      doc.text("Lançamentos", 14, 20);
      autoTable(doc, {
        startY: 24,
        head: [["Descrição", "Tipo", "Categoria", "Valor", "Vencimento", "Status"]],
        body: filtered.map((r) => [
          r.description,
          r.type === "income" ? "Receita" : "Despesa",
          r.category || "—",
          currencyFmt(r.amount),
          r.due_date ? format(new Date(r.due_date), "dd/MM/yyyy") : "—",
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
        <div className="flex gap-2">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por obra" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as obras</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.description}</TableCell>
                    <TableCell>
                      <Badge variant={r.type === "income" ? "default" : "destructive"}>
                        {r.type === "income" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.category || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{currencyFmt(r.amount)}</TableCell>
                    <TableCell>{r.due_date ? format(new Date(r.due_date), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell>
                      {r.paid_at ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-600">Pago</Badge>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => markPaidMutation.mutate(r.id)}>
                          Marcar pago
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
