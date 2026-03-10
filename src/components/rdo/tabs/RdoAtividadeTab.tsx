import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Trash2, Clock } from "lucide-react";
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

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function RdoAtividadeTab({ rdoDiaId, companyId, canEdit }: Props) {
  const { toast } = useToast();
  const { isDemo } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [hora, setHora] = useState("");
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

  // Sort by hora field
  const sortedAtividades = [...atividades].sort((a: any, b: any) => {
    const ha = a.hora || "99:99";
    const hb = b.hora || "99:99";
    return ha.localeCompare(hb);
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!hora.trim()) throw new Error("Horário obrigatório");
      if (!desc.trim()) throw new Error("Descrição obrigatória");
      if (!/^\d{2}:\d{2}$/.test(hora.trim())) throw new Error("Formato de hora inválido (HH:MM)");
      const { error } = await supabase.from("rdo_atividade").insert({
        rdo_dia_id: rdoDiaId,
        company_id: companyId,
        hora: hora.trim(),
        descricao: desc.trim(),
        tipo_atividade: tipo,
        impacto_cronograma: impacto,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rdo_atividade", rdoDiaId] });
      setDesc(""); setHora(""); setShowForm(false);
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

  const handleRegisterNow = () => {
    setHora(getCurrentTime());
    setShowForm(true);
  };

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      {sortedAtividades.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-3">Nenhuma atividade registrada.</p>
      )}

      {/* Timeline view */}
      {sortedAtividades.length > 0 && (
        <div className="relative pl-6 border-l-2 border-muted space-y-1">
          {sortedAtividades.map((a: any) => (
            <div key={a.id} className="relative flex items-start gap-2 py-1.5">
              {/* Timeline dot */}
              <div className="absolute -left-[25px] top-2.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />

              <div className="flex items-start gap-2 flex-1 p-2 rounded-md border bg-card min-w-0">
                {canEdit && (
                  <Checkbox
                    checked={a.concluida}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: a.id, concluida: !!v })}
                    className="mt-0.5"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-primary shrink-0">
                      {a.hora || "--:--"}
                    </span>
                    <span className="text-xs text-muted-foreground">–</span>
                    <p className={`text-sm ${a.concluida ? "line-through text-muted-foreground" : ""}`}>
                      {a.descricao}
                    </p>
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
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteMutation.mutate(a.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="space-y-2 p-3 rounded-md border bg-muted/30">
          <div className="flex gap-2">
            <Input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-28 shrink-0 font-mono"
              placeholder="HH:MM"
              required
            />
            <Input
              placeholder="Descrição da atividade..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="flex-1"
              required
            />
          </div>
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowForm(true)}>
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
