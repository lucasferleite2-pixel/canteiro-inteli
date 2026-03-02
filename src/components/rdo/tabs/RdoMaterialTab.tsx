import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DEMO_MATERIAIS } from "@/lib/demoData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const tiposMaterial = ["Compra", "Aluguel", "Consumo"];

interface Props {
  rdoDiaId: string;
  companyId: string;
  canEdit: boolean;
}

export function RdoMaterialTab({ rdoDiaId, companyId, canEdit }: Props) {
  const { toast } = useToast();
  const { isDemo } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tipo: "Consumo", item: "", quantidade: "", unidade: "un", valor_unitario: "", previsto: true });

  const { data: materiais = [], isLoading } = useQuery({
    queryKey: ["rdo_material", rdoDiaId],
    queryFn: async () => {
      if (isDemo) return DEMO_MATERIAIS.filter((m) => m.rdo_dia_id === rdoDiaId);
      const { data, error } = await supabase
        .from("rdo_material")
        .select("*")
        .eq("rdo_dia_id", rdoDiaId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.item.trim()) throw new Error("Item obrigatório");
      const qtd = parseFloat(form.quantidade) || 0;
      const vu = parseFloat(form.valor_unitario) || 0;
      const { error } = await supabase.from("rdo_material").insert({
        rdo_dia_id: rdoDiaId,
        company_id: companyId,
        tipo: form.tipo,
        item: form.item.trim(),
        quantidade: qtd,
        unidade: form.unidade,
        valor_unitario: vu,
        valor_total: qtd * vu,
        previsto_em_orcamento: form.previsto,
        gera_alerta_desequilibrio: !form.previsto,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rdo_material", rdoDiaId] });
      setForm({ tipo: "Consumo", item: "", quantidade: "", unidade: "un", valor_unitario: "", previsto: true });
      setShowForm(false);
      toast({ title: "Material adicionado!" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rdo_material").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rdo_material", rdoDiaId] });
      toast({ title: "Material removido!" });
    },
  });

  const totalDia = materiais.reduce((s: number, m: any) => s + Number(m.valor_total || 0), 0);
  const totalNaoPrevisto = materiais.filter((m: any) => !m.previsto_em_orcamento).reduce((s: number, m: any) => s + Number(m.valor_total || 0), 0);

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      {materiais.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs text-right">Qtd</TableHead>
                  <TableHead className="text-xs text-right">Unit.</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materiais.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        {!m.previsto_em_orcamento && <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />}
                        {m.item}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] h-5">{m.tipo}</Badge></TableCell>
                    <TableCell className="text-xs text-right">{Number(m.quantidade).toLocaleString("pt-BR")} {m.unidade}</TableCell>
                    <TableCell className="text-xs text-right">R$ {Number(m.valor_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-xs text-right font-medium">R$ {Number(m.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteMutation.mutate(m.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total do dia: <span className="font-semibold text-foreground">R$ {totalDia.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
            {totalNaoPrevisto > 0 && (
              <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Não previsto: R$ {totalNaoPrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </>
      )}

      {materiais.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-3">Nenhum material registrado.</p>
      )}

      {showForm && (
        <div className="space-y-2 p-3 rounded-md border bg-muted/30">
          <Input placeholder="Item / Material..." value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tiposMaterial.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Qtd" type="number" className="h-8 text-xs" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
            <Input placeholder="Valor unit." type="number" step="0.01" className="h-8 text-xs" value={form.valor_unitario} onChange={(e) => setForm({ ...form, valor_unitario: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.previsto} onCheckedChange={(v) => setForm({ ...form, previsto: v })} id="previsto" />
            <Label htmlFor="previsto" className="text-xs">Previsto em orçamento</Label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {canEdit && !showForm && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar Material
        </Button>
      )}
    </div>
  );
}
