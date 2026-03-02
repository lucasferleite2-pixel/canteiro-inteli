import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Trash2 } from "lucide-react";
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

interface Props {
  rdoDiaId: string;
  companyId: string;
  canEdit: boolean;
}

export function RdoAtividadeTab({ rdoDiaId, companyId, canEdit }: Props) {
  const { toast } = useToast();
  const { isDemo } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState("");
  const [tipo, setTipo] = useState("Execução");
  const [impacto, setImpacto] = useState("nenhum");

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

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!desc.trim()) throw new Error("Descrição obrigatória");
      const { error } = await supabase.from("rdo_atividade").insert({
        rdo_dia_id: rdoDiaId,
        company_id: companyId,
        descricao: desc.trim(),
        tipo_atividade: tipo,
        impacto_cronograma: impacto,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rdo_atividade", rdoDiaId] });
      setDesc(""); setShowForm(false);
      toast({ title: "Atividade adicionada!" });
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

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      {atividades.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-3">Nenhuma atividade registrada.</p>
      )}

      {atividades.map((a: any) => (
        <div key={a.id} className="flex items-start gap-2 p-2 rounded-md border bg-card">
          {canEdit && (
            <Checkbox
              checked={a.concluida}
              onCheckedChange={(v) => toggleMutation.mutate({ id: a.id, concluida: !!v })}
              className="mt-0.5"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${a.concluida ? "line-through text-muted-foreground" : ""}`}>{a.descricao}</p>
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
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteMutation.mutate(a.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      ))}

      {showForm && (
        <div className="space-y-2 p-3 rounded-md border bg-muted/30">
          <Input placeholder="Descrição da atividade..." value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tiposAtividade.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={impacto} onValueChange={setImpacto}>
              <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {impactoCronograma.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
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
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar Atividade
        </Button>
      )}
    </div>
  );
}
