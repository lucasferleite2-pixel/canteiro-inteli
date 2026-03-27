import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Trash2, AlertTriangle, DollarSign, Pencil, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DEMO_DESPESAS } from "@/lib/demoData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const tiposDespesa = [
  { value: "material", label: "Material" },
  { value: "mao_de_obra", label: "Mão de Obra" },
  { value: "equipamento", label: "Equipamento" },
  { value: "transporte", label: "Transporte" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "combustivel", label: "Combustível" },
  { value: "ferramentas", label: "Ferramentas" },
  { value: "epi", label: "EPI" },
  { value: "locacao", label: "Locação" },
  { value: "servico_terceiro", label: "Serviço Terceirizado" },
  { value: "administrativo", label: "Administrativo" },
  { value: "outro", label: "Outro (especificar)" },
];

const tipoLabels: Record<string, string> = {
  material: "Material",
  mao_de_obra: "Mão de Obra",
  equipamento: "Equipamento",
  transporte: "Transporte",
  alimentacao: "Alimentação",
  combustivel: "Combustível",
  ferramentas: "Ferramentas",
  epi: "EPI",
  locacao: "Locação",
  servico_terceiro: "Serviço Terceirizado",
  administrativo: "Administrativo",
  outro: "Outro",
};

const emptyForm = {
  tipo: "material",
  tipo_customizado: "",
  descricao: "",
  quantidade: "",
  unidade: "un",
  valor_unitario: "",
  centro_custo: "",
  previsto_no_orcamento: true,
  incluir_no_pdf: true,
  afeta_curva_financeira: true,
  observacao: "",
};

interface Props {
  rdoDiaId: string;
  companyId: string;
  canEdit: boolean;
}

export function RdoDespesaTab({ rdoDiaId, companyId, canEdit }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isDemo, user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ["rdo_despesa_item", rdoDiaId],
    queryFn: async () => {
      if (isDemo) return DEMO_DESPESAS.filter((d) => d.rdo_dia_id === rdoDiaId);
      const { data, error } = await supabase
        .from("rdo_despesa_item")
        .select("*")
        .eq("rdo_dia_id", rdoDiaId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setForm({ ...emptyForm });
    setShowForm(false);
    setEditingId(null);
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.descricao.trim()) throw new Error("Descrição obrigatória");
      const qtd = parseFloat(form.quantidade) || 0;
      const vu = parseFloat(form.valor_unitario) || 0;
      if (qtd <= 0 || vu <= 0) throw new Error("Quantidade e valor unitário devem ser maiores que zero");
      const { error } = await supabase.from("rdo_despesa_item").insert({
        rdo_dia_id: rdoDiaId,
        company_id: companyId,
        tipo: form.tipo,
        descricao: form.descricao.trim(),
        quantidade: qtd,
        unidade: form.unidade || "un",
        valor_unitario: vu,
        centro_custo: form.centro_custo || null,
        previsto_no_orcamento: form.previsto_no_orcamento,
        incluir_no_pdf: form.incluir_no_pdf,
        afeta_curva_financeira: form.afeta_curva_financeira,
        observacao: form.observacao || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rdo_despesa_item", rdoDiaId] });
      resetForm();
      toast({ title: "Despesa adicionada!" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      if (!form.descricao.trim()) throw new Error("Descrição obrigatória");
      const qtd = parseFloat(form.quantidade) || 0;
      const vu = parseFloat(form.valor_unitario) || 0;
      if (qtd <= 0 || vu <= 0) throw new Error("Quantidade e valor unitário devem ser maiores que zero");
      const { error } = await supabase.from("rdo_despesa_item").update({
        tipo: form.tipo,
        descricao: form.descricao.trim(),
        quantidade: qtd,
        unidade: form.unidade || "un",
        valor_unitario: vu,
        centro_custo: form.centro_custo || null,
        previsto_no_orcamento: form.previsto_no_orcamento,
        incluir_no_pdf: form.incluir_no_pdf,
        afeta_curva_financeira: form.afeta_curva_financeira,
        observacao: form.observacao || null,
      }).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rdo_despesa_item", rdoDiaId] });
      resetForm();
      toast({ title: "Despesa atualizada!" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rdo_despesa_item").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rdo_despesa_item", rdoDiaId] });
      toast({ title: "Despesa removida!" });
    },
  });

  const startEdit = (d: any) => {
    setEditingId(d.id);
    setForm({
      tipo: d.tipo,
      descricao: d.descricao,
      quantidade: String(d.quantidade),
      unidade: d.unidade || "un",
      valor_unitario: String(d.valor_unitario),
      centro_custo: d.centro_custo || "",
      previsto_no_orcamento: d.previsto_no_orcamento ?? true,
      incluir_no_pdf: d.incluir_no_pdf ?? true,
      afeta_curva_financeira: d.afeta_curva_financeira ?? true,
      observacao: d.observacao || "",
    });
    setShowForm(true);
  };

  const totalDia = despesas.reduce((s: number, d: any) => s + Number(d.valor_total || 0), 0);
  const totalNaoPrevisto = despesas
    .filter((d: any) => !d.previsto_no_orcamento)
    .reduce((s: number, d: any) => s + Number(d.valor_total || 0), 0);
  const totalCurvaFinanceira = despesas
    .filter((d: any) => d.afeta_curva_financeira)
    .reduce((s: number, d: any) => s + Number(d.valor_total || 0), 0);

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const isEditing = !!editingId;
  const isSaving = isEditing ? updateMutation.isPending : addMutation.isPending;

  return (
    <div className="space-y-3">
      {despesas.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs text-right">Qtd</TableHead>
                  <TableHead className="text-xs text-right">Unit.</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs text-center">PDF</TableHead>
                  <TableHead className="text-xs w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despesas.map((d: any) => (
                  <TableRow key={d.id} className={editingId === d.id ? "bg-primary/5" : ""}>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        {!d.previsto_no_orcamento && <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />}
                        <span className="truncate max-w-[180px]">{d.descricao}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] h-5">{tipoLabels[d.tipo] || d.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right">{Number(d.quantidade).toLocaleString("pt-BR")} {d.unidade}</TableCell>
                    <TableCell className="text-xs text-right">R$ {Number(d.valor_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-xs text-right font-medium">R$ {Number(d.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center">
                      {d.incluir_no_pdf ? <span className="text-green-600 text-xs">✓</span> : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      {canEdit && !isDemo && (
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(d)}>
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteMutation.mutate(d.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap justify-between text-xs gap-2">
            <span className="text-muted-foreground">
              Total do dia: <span className="font-semibold text-foreground">R$ {totalDia.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </span>
            <span className="text-muted-foreground">
              Curva financeira: <span className="font-semibold text-foreground">R$ {totalCurvaFinanceira.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </span>
            {totalNaoPrevisto > 0 && (
              <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Não previsto: R$ {totalNaoPrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </>
      )}

      {despesas.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-3">Nenhuma despesa registrada.</p>
      )}

      {showForm && (
        <div className="space-y-2 p-3 rounded-md border bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{isEditing ? "Editar despesa" : "Nova despesa"}</span>
            {isEditing && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetForm}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <Input placeholder="Descrição da despesa..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tiposDespesa.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Qtd" type="number" className="h-8 text-xs" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
            <Input placeholder="Unidade" className="h-8 text-xs" value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
            <Input placeholder="Valor unit." type="number" step="0.01" className="h-8 text-xs" value={form.valor_unitario} onChange={(e) => setForm({ ...form, valor_unitario: e.target.value })} />
          </div>
          <Input placeholder="Centro de custo (opcional)" className="h-8 text-xs" value={form.centro_custo} onChange={(e) => setForm({ ...form, centro_custo: e.target.value })} />
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={form.previsto_no_orcamento} onCheckedChange={(v) => setForm({ ...form, previsto_no_orcamento: v })} id="previsto_orc" />
              <Label htmlFor="previsto_orc" className="text-xs">Previsto no orçamento</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.incluir_no_pdf} onCheckedChange={(v) => setForm({ ...form, incluir_no_pdf: v })} id="incluir_pdf" />
              <Label htmlFor="incluir_pdf" className="text-xs">Incluir no PDF</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.afeta_curva_financeira} onCheckedChange={(v) => setForm({ ...form, afeta_curva_financeira: v })} id="afeta_curva" />
              <Label htmlFor="afeta_curva" className="text-xs">Afeta curva financeira</Label>
            </div>
          </div>
          <Textarea placeholder="Observação (opcional)" className="text-xs min-h-[60px]" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => isEditing ? updateMutation.mutate() : addMutation.mutate()} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {isEditing ? "Atualizar" : "Salvar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>Cancelar</Button>
          </div>
        </div>
      )}

      {canEdit && !showForm && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar Despesa
        </Button>
      )}

      {despesas.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-1 text-xs text-muted-foreground"
          onClick={() => navigate(isDemo ? "/financeiro?demo=true" : "/financeiro")}
        >
          <DollarSign className="h-3.5 w-3.5" /> Ver no financeiro
        </Button>
      )}
    </div>
  );
}
