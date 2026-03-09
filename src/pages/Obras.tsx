import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Building2, MapPin, Calendar, DollarSign, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_OBRAS } from "@/lib/demoData";
import { DemoBanner } from "@/components/DemoBanner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  planning: { label: "Planejamento", variant: "secondary" },
  in_progress: { label: "Em Andamento", variant: "default" },
  paused: { label: "Pausada", variant: "outline" },
  completed: { label: "Concluída", variant: "secondary" },
};

export default function Obras() {
  const { companyId, isDemo } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    address: "",
    municipality: "",
    budget: "",
    start_date: "",
    expected_end_date: "",
    status: "planning",
  });

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !isDemo,
  });

  const resolvedObras = isDemo ? DEMO_OBRAS : obras;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      const { error } = await supabase.from("projects").insert({
        company_id: companyId,
        name: form.name,
        description: form.description || null,
        address: form.address || null,
        municipality: form.municipality || null,
        budget: form.budget ? parseFloat(form.budget) : 0,
        start_date: form.start_date || null,
        expected_end_date: form.expected_end_date || null,
        status: form.status,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setForm({ name: "", description: "", address: "", budget: "", start_date: "", expected_end_date: "", status: "planning" });
      toast({ title: "Obra criada com sucesso!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      <DemoBanner />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Obras</h1>
          <p className="text-muted-foreground">Gerencie todas as suas obras em um só lugar.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nova Obra</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Obra</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Nome da Obra *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Orçamento (R$)</Label>
                  <Input type="number" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planejamento</SelectItem>
                      <SelectItem value="in_progress">Em Andamento</SelectItem>
                      <SelectItem value="paused">Pausada</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Previsão de Término</Label>
                  <Input type="date" value={form.expected_end_date} onChange={(e) => setForm({ ...form, expected_end_date: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Obra
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!isDemo && isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : resolvedObras.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhuma obra cadastrada</p>
            <p className="text-sm text-muted-foreground/70 mb-4">Cadastre sua primeira obra para começar.</p>
            <Button variant="outline" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Cadastrar Obra
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resolvedObras.map((obra) => {
            const st = statusMap[obra.status] || statusMap.planning;
            return (
              <Card key={obra.id} className="hover:border-primary/30 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{obra.name}</CardTitle>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                  {obra.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{obra.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {obra.address && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />{obra.address}
                    </div>
                  )}
                  {obra.budget ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />{formatCurrency(obra.budget)}
                    </div>
                  ) : null}
                  {obra.start_date && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Início: {new Date(obra.start_date).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
