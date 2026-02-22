import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ClipboardList, Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Users, Calendar, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const weatherOptions = [
  { value: "ensolarado", label: "Ensolarado", icon: Sun },
  { value: "nublado", label: "Nublado", icon: Cloud },
  { value: "chuvoso", label: "Chuvoso", icon: CloudRain },
  { value: "tempestade", label: "Tempestade", icon: CloudLightning },
  { value: "neve", label: "Neve/Frio Extremo", icon: CloudSnow },
];

const weatherIcon = (weather: string | null) => {
  const opt = weatherOptions.find((o) => o.value === weather);
  if (!opt) return null;
  const Icon = opt.icon;
  return <Icon className="h-4 w-4" />;
};

export default function DiarioObra() {
  const { companyId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().split("T")[0],
    weather: "",
    team_count: "",
    activities: "",
    occurrences: "",
    materials: "",
    technical_comments: "",
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["diary_entries", companyId, selectedProject],
    queryFn: async () => {
      if (!companyId) return [];
      let q = supabase
        .from("diary_entries")
        .select("*, projects(name)")
        .eq("company_id", companyId)
        .order("entry_date", { ascending: false });
      if (selectedProject) {
        q = q.eq("project_id", selectedProject);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Sem empresa ou usuário");
      if (!selectedProject) throw new Error("Selecione uma obra");
      const { error } = await supabase.from("diary_entries").insert({
        company_id: companyId,
        project_id: selectedProject,
        author_id: user.id,
        entry_date: form.entry_date,
        weather: form.weather || null,
        team_count: form.team_count ? parseInt(form.team_count) : 0,
        activities: form.activities || null,
        occurrences: form.occurrences || null,
        materials: form.materials || null,
        technical_comments: form.technical_comments || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary_entries"] });
      setOpen(false);
      setForm({ entry_date: new Date().toISOString().split("T")[0], weather: "", team_count: "", activities: "", occurrences: "", materials: "", technical_comments: "" });
      toast({ title: "Registro criado com sucesso!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const formatDate = (d: string) => {
    try {
      return format(new Date(d + "T12:00:00"), "dd 'de' MMM, yyyy", { locale: ptBR });
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diário de Obra</h1>
          <p className="text-muted-foreground">Registros diários de atividades, equipe, clima e ocorrências.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!selectedProject}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Registro Diário</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Obra</Label>
                <Input value={projects.find((p) => p.id === selectedProject)?.name || ""} disabled />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Clima</Label>
                  <Select value={form.weather} onValueChange={(v) => setForm({ ...form, weather: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {weatherOptions.map((w) => (
                        <SelectItem key={w.value} value={w.value}>
                          <span className="flex items-center gap-2">
                            <w.icon className="h-4 w-4" /> {w.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Equipe em campo (nº de pessoas)</Label>
                <Input type="number" min="0" value={form.team_count} onChange={(e) => setForm({ ...form, team_count: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Atividades Realizadas</Label>
                <Textarea rows={3} value={form.activities} onChange={(e) => setForm({ ...form, activities: e.target.value })} placeholder="Descreva as atividades do dia..." />
              </div>
              <div className="space-y-2">
                <Label>Ocorrências</Label>
                <Textarea rows={2} value={form.occurrences} onChange={(e) => setForm({ ...form, occurrences: e.target.value })} placeholder="Incidentes, atrasos, problemas..." />
              </div>
              <div className="space-y-2">
                <Label>Materiais Utilizados</Label>
                <Textarea rows={2} value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} placeholder="Materiais recebidos ou consumidos..." />
              </div>
              <div className="space-y-2">
                <Label>Comentários Técnicos</Label>
                <Textarea rows={2} value={form.technical_comments} onChange={(e) => setForm({ ...form, technical_comments: e.target.value })} placeholder="Observações técnicas relevantes..." />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Registro
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Project filter */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium">Obra:</Label>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Selecione uma obra" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Entries list */}
      {!selectedProject ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Selecione uma obra</p>
            <p className="text-sm text-muted-foreground/70">Escolha uma obra acima para visualizar ou criar registros diários.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhum registro de diário</p>
            <p className="text-sm text-muted-foreground/70 mb-4">Adicione o primeiro registro diário desta obra.</p>
            <Button variant="outline" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Adicionar Registro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <Card key={entry.id} className="hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{formatDate(entry.entry_date)}</CardTitle>
                    {entry.is_locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.weather && (
                      <Badge variant="outline" className="gap-1">
                        {weatherIcon(entry.weather)}
                        {weatherOptions.find((w) => w.value === entry.weather)?.label || entry.weather}
                      </Badge>
                    )}
                    {entry.team_count != null && entry.team_count > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" /> {entry.team_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {entry.activities && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Atividades</p>
                    <p className="whitespace-pre-line">{entry.activities}</p>
                  </div>
                )}
                {entry.occurrences && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Ocorrências</p>
                    <p className="whitespace-pre-line">{entry.occurrences}</p>
                  </div>
                )}
                {entry.materials && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Materiais</p>
                    <p className="whitespace-pre-line">{entry.materials}</p>
                  </div>
                )}
                {entry.technical_comments && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Comentários Técnicos</p>
                    <p className="whitespace-pre-line">{entry.technical_comments}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
