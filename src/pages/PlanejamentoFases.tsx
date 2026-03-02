import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Target, Trash2, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_OBRAS, DEMO_FASE_PLANEJAMENTO } from "@/lib/demoData";
import { DemoBanner } from "@/components/DemoBanner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const faseOptions = ["Fundação", "Estrutura", "Alvenaria", "Cobertura", "Instalações", "Acabamento", "Pavimentação", "Demolição"];
const unidadeOptions = ["m²", "m³", "metro linear", "unidade", "ton", "kg"];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatNumber = (v: number) =>
  new Intl.NumberFormat("pt-BR").format(v);

export default function PlanejamentoFases() {
  const { companyId, isDemo } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedObraId, setSelectedObraId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    fase: "Fundação",
    quantidade_planejada: "",
    custo_planejado: "",
    unidade: "m²",
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status, budget")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !isDemo,
  });

  const resolvedObras = isDemo ? DEMO_OBRAS : obras;

  const { data: fases = [], isLoading } = useQuery({
    queryKey: ["obra_fase_planejamento", selectedObraId],
    queryFn: async () => {
      if (!selectedObraId) return [];
      const { data, error } = await supabase
        .from("obra_fase_planejamento")
        .select("*")
        .eq("obra_id", selectedObraId)
        .order("fase");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedObraId && !isDemo,
  });

  const resolvedFases = isDemo
    ? DEMO_FASE_PLANEJAMENTO.filter((f) => f.obra_id === selectedObraId)
    : fases;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !selectedObraId) throw new Error("Dados faltando");
      const payload = {
        obra_id: selectedObraId,
        company_id: companyId,
        fase: form.fase,
        quantidade_planejada: parseFloat(form.quantidade_planejada) || 0,
        custo_planejado: parseFloat(form.custo_planejado) || 0,
        unidade: form.unidade,
      };
      if (editingId) {
        const { error } = await supabase.from("obra_fase_planejamento").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("obra_fase_planejamento").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obra_fase_planejamento", selectedObraId] });
      toast({ title: editingId ? "Fase atualizada!" : "Fase cadastrada!" });
      closeDialog();
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_fase_planejamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obra_fase_planejamento", selectedObraId] });
      toast({ title: "Fase removida!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ fase: "Fundação", quantidade_planejada: "", custo_planejado: "", unidade: "m²" });
  };

  const openEdit = (fase: any) => {
    setEditingId(fase.id);
    setForm({
      fase: fase.fase,
      quantidade_planejada: String(fase.quantidade_planejada),
      custo_planejado: String(fase.custo_planejado),
      unidade: fase.unidade,
    });
    setDialogOpen(true);
  };

  const totalPlanejado = resolvedFases.reduce((s, f) => s + (f.custo_planejado || 0), 0);
  const selectedObra = resolvedObras.find((o) => o.id === selectedObraId);

  return (
    <div className="space-y-6">
      <DemoBanner />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planejamento por Fase</h1>
          <p className="text-muted-foreground">Cadastre metas de quantidade e custo por fase de cada obra.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="space-y-1.5 w-80">
          <Label className="text-xs">Obra</Label>
          <Select value={selectedObraId} onValueChange={setSelectedObraId}>
            <SelectTrigger><SelectValue placeholder="Selecione uma obra" /></SelectTrigger>
            <SelectContent>
              {resolvedObras.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedObraId && (
          <div className="pt-5">
            <Button onClick={() => setDialogOpen(true)} disabled={isDemo}>
              <Plus className="mr-2 h-4 w-4" />Nova Fase
            </Button>
          </div>
        )}
      </div>

      {!selectedObraId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Selecione uma obra</p>
            <p className="text-sm text-muted-foreground/70">Escolha uma obra acima para gerenciar as fases de planejamento.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {selectedObra && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground font-normal">Orçamento da Obra</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{formatCurrency(selectedObra.budget || 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground font-normal">Total Planejado (Fases)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{formatCurrency(totalPlanejado)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground font-normal">Cobertura Orçamentária</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">
                    {selectedObra.budget ? ((totalPlanejado / selectedObra.budget) * 100).toFixed(1) : 0}%
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fases Cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              {!isDemo && isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : resolvedFases.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma fase cadastrada para esta obra.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fase</TableHead>
                      <TableHead className="text-right">Qtd. Planejada</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Custo Planejado</TableHead>
                      <TableHead className="text-right">Custo/Unidade</TableHead>
                      {!isDemo && <TableHead className="w-24">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resolvedFases.map((fase) => (
                      <TableRow key={fase.id}>
                        <TableCell>
                          <Badge variant="outline">{fase.fase}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(fase.quantidade_planejada)}</TableCell>
                        <TableCell>{fase.unidade}</TableCell>
                        <TableCell className="text-right">{formatCurrency(fase.custo_planejado)}</TableCell>
                        <TableCell className="text-right">
                          {fase.quantidade_planejada > 0
                            ? formatCurrency(fase.custo_planejado / fase.quantidade_planejada)
                            : "—"}
                        </TableCell>
                        {!isDemo && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(fase)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => deleteMutation.mutate(fase.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Fase" : "Nova Fase de Planejamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Fase *</Label>
              <Select value={form.fase} onValueChange={(v) => setForm({ ...form, fase: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {faseOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantidade Planejada *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.quantidade_planejada}
                  onChange={(e) => setForm({ ...form, quantidade_planejada: e.target.value })}
                  placeholder="Ex: 450"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unidade</Label>
                <Select value={form.unidade} onValueChange={(v) => setForm({ ...form, unidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {unidadeOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Custo Planejado (R$) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.custo_planejado}
                onChange={(e) => setForm({ ...form, custo_planejado: e.target.value })}
                placeholder="Ex: 720000"
              />
            </div>
            {form.quantidade_planejada && form.custo_planejado && (
              <p className="text-xs text-muted-foreground">
                Custo por unidade: {formatCurrency(parseFloat(form.custo_planejado) / parseFloat(form.quantidade_planejada))}
              </p>
            )}
            <Button
              className="w-full"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.quantidade_planejada || !form.custo_planejado}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Salvar Alterações" : "Cadastrar Fase"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
