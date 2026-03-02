import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Trash2, ShieldAlert, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const tiposOcorrencia = ["Clima", "Logística", "Técnica", "Fornecedor", "Planejamento", "Fiscalização"];
const impactoOptions = [
  { value: "baixo", label: "Baixo" },
  { value: "médio", label: "Médio" },
  { value: "alto", label: "Alto" },
  { value: "crítico", label: "Crítico" },
];

const impactoColors: Record<string, string> = {
  baixo: "bg-green-500/10 text-green-700 dark:text-green-400",
  "médio": "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  alto: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  "crítico": "bg-red-500/10 text-red-700 dark:text-red-400",
};

interface Props {
  rdoDiaId: string;
  companyId: string;
  canEdit: boolean;
}

export function RdoOcorrenciaTab({ rdoDiaId, companyId, canEdit }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tipo: "Técnica", descricao: "", impacto: "baixo", responsavel: "", risco_contratual: false });

  const { data: ocorrencias = [], isLoading } = useQuery({
    queryKey: ["rdo_ocorrencia", rdoDiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rdo_ocorrencia")
        .select("*")
        .eq("rdo_dia_id", rdoDiaId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.descricao.trim()) throw new Error("Descrição obrigatória");
      const { error } = await supabase.from("rdo_ocorrencia").insert({
        rdo_dia_id: rdoDiaId,
        company_id: companyId,
        tipo_ocorrencia: form.tipo,
        descricao: form.descricao.trim(),
        impacto: form.impacto,
        responsavel: form.responsavel || null,
        gera_risco_contratual: form.risco_contratual,
        gera_alerta: form.impacto === "alto" || form.impacto === "crítico",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rdo_ocorrencia", rdoDiaId] });
      setForm({ tipo: "Técnica", descricao: "", impacto: "baixo", responsavel: "", risco_contratual: false });
      setShowForm(false);
      toast({ title: "Ocorrência registrada!" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rdo_ocorrencia").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rdo_ocorrencia", rdoDiaId] });
      toast({ title: "Ocorrência removida!" });
    },
  });

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      {ocorrencias.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-3">Nenhuma ocorrência registrada.</p>
      )}

      {ocorrencias.map((o: any) => (
        <div key={o.id} className="p-2.5 rounded-md border bg-card space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm flex-1">{o.descricao}</p>
            {canEdit && (
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => deleteMutation.mutate(o.id)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] h-5">{o.tipo_ocorrencia}</Badge>
            <Badge className={`text-[10px] h-5 ${impactoColors[o.impacto] || ""}`}>
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> {o.impacto}
            </Badge>
            {o.gera_risco_contratual && (
              <Badge variant="destructive" className="text-[10px] h-5 gap-0.5">
                <ShieldAlert className="h-2.5 w-2.5" /> Risco contratual
              </Badge>
            )}
            {o.responsavel && <Badge variant="secondary" className="text-[10px] h-5">{o.responsavel}</Badge>}
          </div>
        </div>
      ))}

      {showForm && (
        <div className="space-y-2 p-3 rounded-md border bg-muted/30">
          <Textarea placeholder="Descrição da ocorrência..." rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tiposOcorrencia.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.impacto} onValueChange={(v) => setForm({ ...form, impacto: v })}>
              <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {impactoOptions.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Responsável (opcional)" className="h-8 text-xs" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
          <div className="flex items-center gap-2">
            <Switch checked={form.risco_contratual} onCheckedChange={(v) => setForm({ ...form, risco_contratual: v })} id="risco" />
            <Label htmlFor="risco" className="text-xs">Gera risco contratual</Label>
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
          <Plus className="mr-1 h-3.5 w-3.5" /> Registrar Ocorrência
        </Button>
      )}
    </div>
  );
}
