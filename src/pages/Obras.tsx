import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, MapPin, Calendar, DollarSign, Loader2, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_OBRAS } from "@/lib/demoData";
import { DemoBanner } from "@/components/DemoBanner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ObraFormDialog, type ObraFormData } from "@/components/obras/ObraFormDialog";

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
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<ObraFormData | null>(null);

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

  const buildPayload = (form: ObraFormData) => ({
    name: form.name,
    description: form.description || null,
    address: form.address || null,
    municipality: form.municipality || null,
    budget: form.budget ? parseFloat(form.budget) : 0,
    start_date: form.start_date || null,
    expected_end_date: form.expected_end_date || null,
    status: form.status,
  });

  const createMutation = useMutation({
    mutationFn: async (form: ObraFormData) => {
      if (!companyId) throw new Error("Sem empresa");
      const { error } = await supabase.from("projects").insert({
        company_id: companyId,
        ...buildPayload(form),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setCreateOpen(false);
      toast({ title: "Obra criada com sucesso!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async (form: ObraFormData) => {
      if (!editingId) throw new Error("Sem ID");
      const { error } = await supabase
        .from("projects")
        .update(buildPayload(form) as any)
        .eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditOpen(false);
      setEditingId(null);
      toast({ title: "Obra atualizada com sucesso!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const openEdit = (obra: any) => {
    setEditingId(obra.id);
    setEditInitial({
      name: obra.name || "",
      description: obra.description || "",
      address: obra.address || "",
      municipality: obra.municipality || "",
      budget: obra.budget ? String(obra.budget) : "",
      start_date: obra.start_date || "",
      expected_end_date: obra.expected_end_date || "",
      status: obra.status || "planning",
    });
    setEditOpen(true);
  };

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
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />Nova Obra
        </Button>
      </div>

      <ObraFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(form) => createMutation.mutate(form)}
        isPending={createMutation.isPending}
        mode="create"
      />

      <ObraFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={(form) => updateMutation.mutate(form)}
        isPending={updateMutation.isPending}
        initialData={editInitial}
        mode="edit"
      />

      {!isDemo && isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : resolvedObras.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhuma obra cadastrada</p>
            <p className="text-sm text-muted-foreground/70 mb-4">Cadastre sua primeira obra para começar.</p>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Cadastrar Obra
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resolvedObras.map((obra) => {
            const st = statusMap[obra.status] || statusMap.planning;
            return (
              <Card key={obra.id} className="hover:border-primary/30 transition-colors group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{obra.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {!isDemo && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => openEdit(obra)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                  </div>
                  {obra.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{obra.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {(obra.municipality || obra.address) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{obra.municipality}{obra.municipality && obra.address ? " — " : ""}{obra.address}</span>
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
