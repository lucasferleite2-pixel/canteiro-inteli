import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Trash2, Clock, Pencil, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DEMO_ATIVIDADES } from "@/lib/demoData";

const tiposAtividade = ["Execução", "Logística", "Compra", "Planejamento", "Fiscalização"];
const impactoCronograma = [
  { value: "nenhum", label: "Nenhum" },
  { value: "leve", label: "Leve" },
  { value: "médio", label: "Médio" },
  { value: "crítico", label: "Crítico" },
];
const fasesObra = [
  "Fundação", "Estrutura", "Alvenaria", "Demolição", "Terraplanagem",
  "Instalações Elétricas", "Instalações Hidráulicas", "Acabamento",
  "Cobertura", "Pintura", "Paisagismo", "Pavimentação", "Outro",
];

interface Props {
  rdoDiaId: string;
  companyId: string;
  canEdit: boolean;
}

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

const emptyForm = { hora: "", desc: "", tipo: "Execução", impacto: "nenhum" };

export function RdoAtividadeTab({ rdoDiaId, companyId, canEdit }: Props) {
  const { toast } = useToast();
  const { isDemo } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ["rdo_atividade", rdoDiaId],
    queryFn: async () => {
      if (isDemo) return DEMO_ATIVIDADES.filter((a) => a.rdo_dia_id === rdoDiaId);
      const { data, error } = await supabase
        .from("rdo_atividade")
        .select("*")
        .eq("rdo_dia_id", rdoDiaId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const sortedAtividades = [...atividades].sort((a: any, b: any) => {
    const ha = a.hora || "99:99";
    const hb = b.hora || "99:99";
    return ha.localeCompare(hb);
  });

  const resetForm = () => {
    setForm({ ...emptyForm });
    setShowForm(false);
    setEditingId(null);
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.hora.trim()) throw new Error("Horário obrigatório");
      if (!form.desc.trim()) throw new Error("Descrição obrigatória");
      if (!/^\d{2}:\d{2}$/.test(form.hora.trim())) throw new Error("Formato de hora inválido (HH:MM)");
      const { error } = await supabase.from("rdo_atividade").insert({
        rdo_dia_id: rdoDiaId,
        company_id: companyId,
        hora: form.hora.trim(),
        descricao: form.desc.trim(),
        tipo_atividade: form.tipo,
        impacto_cronograma: form.impacto,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rdo_atividade", rdoDiaId] });
      resetForm();
      toast({ title: "Atividade adicionada!" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      if (!form.hora.trim()) throw new Error("Horário obrigatório");
      if (!form.desc.trim()) throw new Error("Descrição obrigatória");
      if (!/^\d{2}:\d{2}$/.test(form.hora.trim())) throw new Error("Formato de hora inválido (HH:MM)");
      const { error } = await supabase.from("rdo_atividade").update({
        hora: form.hora.trim(),
        descricao: form.desc.trim(),
        tipo_atividade: form.tipo,
        impacto_cronograma: form.impacto,
      }).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rdo_atividade", rdoDiaId] });
      resetForm();
      toast({ title: "Atividade atualizada!" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await supabase.from("rdo_atividade").update({ concluida }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rdo_atividade", rdoDiaId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rdo_atividade").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rdo_atividade", rdoDiaId] });
      toast({ title: "Atividade removida!" });
    },
  });

  const impactoColor: Record<string, string> = {
    nenhum: "",
    leve: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    "médio": "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    "crítico": "bg-red-500/10 text-red-700 dark:text-red-400",
  };

  const startEdit = (a: any) => {
    setEditingId(a.id);
    setForm({
      hora: a.hora || "",
      desc: a.descricao,
      tipo: a.tipo_atividade,
      impacto: a.impacto_cronograma || "nenhum",
    });
    setShowForm(true);
  };

  const handleRegisterNow = () => {
    resetForm();
    setForm((f) => ({ ...f, hora: getCurrentTime() }));
    setShowForm(true);
  };

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const isEditing = !!editingId;
  const isSaving = isEditing ? updateMutation.isPending : addMutation.isPending;

  return (
    <div className="space-y-3">
      {sortedAtividades.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-3">Nenhuma atividade registrada.</p>
      )}

      {sortedAtividades.length > 0 && (
        <div className="relative pl-6 border-l-2 border-muted space-y-1">
          {sortedAtividades.map((a: any) => (
            <div key={a.id} className="relative flex items-start gap-2 py-1.5">
              <div className="absolute -left-[25px] top-2.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
              <div className={`flex items-start gap-2 flex-1 p-2 rounded-md border bg-card min-w-0 ${editingId === a.id ? "ring-2 ring-primary/30" : ""}`}>
                {canEdit && (
                  <Checkbox
                    checked={a.concluida}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: a.id, concluida: !!v })}
                    className="mt-0.5"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-primary shrink-0">{a.hora || "--:--"}</span>
                    <span className="text-xs text-muted-foreground">–</span>
                    <p className={`text-sm ${a.concluida ? "line-through text-muted-foreground" : ""}`}>{a.descricao}</p>
                  </div>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] h-5">{a.tipo_atividade}</Badge>
                    {a.impacto_cronograma !== "nenhum" && (
                      <Badge className={`text-[10px] h-5 ${impactoColor[a.impacto_cronograma] || ""}`}>
                        Impacto: {a.impacto_cronograma}
                      </Badge>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(a)}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(a.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="space-y-2 p-3 rounded-md border bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{isEditing ? "Editar atividade" : "Nova atividade"}</span>
            {isEditing && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetForm}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              type="time"
              value={form.hora}
              onChange={(e) => setForm({ ...form, hora: e.target.value })}
              className="w-28 shrink-0 font-mono"
              placeholder="HH:MM"
              required
            />
            <Input
              placeholder="Descrição da atividade..."
              value={form.desc}
              onChange={(e) => setForm({ ...form, desc: e.target.value })}
              className="flex-1"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tiposAtividade.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.impacto} onValueChange={(v) => setForm({ ...form, impacto: v })}>
              <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {impactoCronograma.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Nova Atividade
          </Button>
          <Button variant="default" size="sm" className="shrink-0" onClick={handleRegisterNow}>
            <Clock className="mr-1 h-3.5 w-3.5" /> Registrar Agora
          </Button>
        </div>
      )}
    </div>
  );
}
