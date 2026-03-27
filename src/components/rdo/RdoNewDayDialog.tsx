import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const climaOptions = ["Ensolarado", "Nublado", "Chuvoso", "Tempestade", "Neve/Frio"];
const faseOptions = ["Fundação", "Estrutura", "Alvenaria", "Cobertura", "Instalações", "Acabamento", "Pavimentação", "Demolição", "Sondagem", "Terraplanagem"];
const riscoOptions = ["baixo", "médio", "alto"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  companyId: string;
  editingRdo?: any;
}

const unidadeOptions = ["m²", "m³", "metro linear", "unidade", "ton", "kg"];

const emptyForm = {
  data: new Date().toISOString().split("T")[0],
  clima: "Ensolarado",
  equipe_total: "0",
  horas_trabalhadas: "8",
  fase_obra: "Fundação",
  percentual_fisico_dia: "0",
  percentual_fisico_acumulado: "0",
  custo_dia: "0",
  produtividade_percentual: "0",
  risco_dia: "baixo",
  observacoes_gerais: "",
  quantidade_executada: "0",
  unidade_medicao: "m²",
};

export function RdoNewDayDialog({ open, onOpenChange, obraId, companyId, editingRdo }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(() => {
    if (editingRdo) return {
      data: editingRdo.data,
      clima: editingRdo.clima,
      equipe_total: String(editingRdo.equipe_total || 0),
      horas_trabalhadas: String(editingRdo.horas_trabalhadas || 8),
      fase_obra: editingRdo.fase_obra || "Fundação",
      percentual_fisico_dia: String(editingRdo.percentual_fisico_dia || 0),
      percentual_fisico_acumulado: String(editingRdo.percentual_fisico_acumulado || 0),
      custo_dia: String(editingRdo.custo_dia || 0),
      produtividade_percentual: String(editingRdo.produtividade_percentual || 0),
      risco_dia: editingRdo.risco_dia || "baixo",
      observacoes_gerais: editingRdo.observacoes_gerais || "",
      quantidade_executada: String(editingRdo.quantidade_executada || 0),
      unidade_medicao: editingRdo.unidade_medicao || "m²",
    };
    return emptyForm;
  });

  const update = (partial: Partial<typeof form>) => setForm((f) => ({ ...f, ...partial }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        obra_id: obraId,
        company_id: companyId,
        data: form.data,
        clima: form.clima,
        equipe_total: parseInt(form.equipe_total) || 0,
        horas_trabalhadas: parseFloat(form.horas_trabalhadas) || 0,
        fase_obra: form.fase_obra,
        percentual_fisico_dia: parseFloat(form.percentual_fisico_dia) || 0,
        percentual_fisico_acumulado: parseFloat(form.percentual_fisico_acumulado) || 0,
        custo_dia: parseFloat(form.custo_dia) || 0,
        produtividade_percentual: parseFloat(form.produtividade_percentual) || 0,
        risco_dia: form.risco_dia,
        observacoes_gerais: form.observacoes_gerais || null,
        quantidade_executada: parseFloat(form.quantidade_executada) || 0,
        unidade_medicao: form.unidade_medicao,
      };

      if (editingRdo) {
        const { error } = await supabase.from("rdo_dia").update(payload).eq("id", editingRdo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rdo_dia").insert({ ...payload, criado_por: user.id });
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ["rdo_dia"] });
      toast({ title: editingRdo ? "RDO atualizado!" : "RDO criado com sucesso!" });
      onOpenChange(false);
      setForm(emptyForm);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingRdo ? "Editar RDO" : "Novo Registro Diário (RDO 2.0)"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data *</Label>
              <Input type="date" value={form.data} onChange={(e) => update({ data: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Clima</Label>
              <Select value={form.clima} onValueChange={(v) => update({ clima: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {climaOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Equipe (pessoas)</Label>
              <Input type="number" min="0" value={form.equipe_total} onChange={(e) => update({ equipe_total: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Horas trab.</Label>
              <Input type="number" min="0" step="0.5" value={form.horas_trabalhadas} onChange={(e) => update({ horas_trabalhadas: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fase da Obra</Label>
              <Select value={form.fase_obra} onValueChange={(v) => update({ fase_obra: v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {faseOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">% Físico do Dia</Label>
              <Input type="number" min="0" max="100" step="0.1" value={form.percentual_fisico_dia} onChange={(e) => update({ percentual_fisico_dia: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">% Físico Acumulado</Label>
              <Input type="number" min="0" max="100" step="0.1" value={form.percentual_fisico_acumulado} onChange={(e) => update({ percentual_fisico_acumulado: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Custo do Dia (R$)</Label>
              <Input type="number" min="0" step="0.01" value={form.custo_dia} onChange={(e) => update({ custo_dia: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Produtividade (%)</Label>
              <Input type="number" min="0" max="100" step="0.1" value={form.produtividade_percentual} onChange={(e) => update({ produtividade_percentual: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Risco do Dia</Label>
              <Select value={form.risco_dia} onValueChange={(v) => update({ risco_dia: v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {riscoOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Qtd. Executada no Dia</Label>
              <Input type="number" min="0" step="0.01" value={form.quantidade_executada} onChange={(e) => update({ quantidade_executada: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unidade de Medição</Label>
              <Select value={form.unidade_medicao} onValueChange={(v) => update({ unidade_medicao: v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {unidadeOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações Gerais</Label>
            <Textarea rows={2} value={form.observacoes_gerais} onChange={(e) => update({ observacoes_gerais: e.target.value })} placeholder="Observações do dia..." />
          </div>

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingRdo ? "Salvar Alterações" : "Criar RDO"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
