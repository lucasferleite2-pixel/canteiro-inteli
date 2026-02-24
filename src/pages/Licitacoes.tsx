import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Gavel, FileDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  open: "Aberta",
  analyzing: "Em Análise",
  proposal_sent: "Proposta Enviada",
  won: "Ganha",
  lost: "Perdida",
  cancelled: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  analyzing: "bg-yellow-100 text-yellow-800",
  proposal_sent: "bg-purple-100 text-purple-800",
  won: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
  cancelled: "bg-muted text-muted-foreground",
};

export default function Licitacoes() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    edital_number: "",
    estimated_value: "",
    opening_date: "",
    deadline: "",
    notes: "",
    status: "open",
  });

  const { data: bids = [], isLoading } = useQuery({
    queryKey: ["bids", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("bids")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const createBid = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não configurada");
      const { error } = await supabase.from("bids").insert({
        company_id: companyId,
        title: form.title,
        edital_number: form.edital_number || null,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
        opening_date: form.opening_date || null,
        deadline: form.deadline || null,
        notes: form.notes || null,
        status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bids"] });
      toast.success("Licitação cadastrada com sucesso!");
      setOpen(false);
      setForm({ title: "", edital_number: "", estimated_value: "", opening_date: "", deadline: "", notes: "", status: "open" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Título é obrigatório");
    createBid.mutate();
  };

  const fmt = (v: number | null) =>
    v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Licitações</h1>
          <p className="text-muted-foreground">Pipeline completo de licitação à execução.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Licitação
        </Button>
      </div>

      {bids.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Gavel className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhuma licitação cadastrada</p>
            <p className="text-sm text-muted-foreground/70 mb-4">Cadastre editais e acompanhe todo o processo licitatório.</p>
            <Button variant="outline" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Licitação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Edital</TableHead>
                  <TableHead>Valor Estimado</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bids.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.title}</TableCell>
                    <TableCell>{b.edital_number || "—"}</TableCell>
                    <TableCell>{fmt(b.estimated_value)}</TableCell>
                    <TableCell>{b.opening_date ? format(new Date(b.opening_date), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell>{b.deadline ? format(new Date(b.deadline), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[b.status] || ""}>
                        {STATUS_LABELS[b.status] || b.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Licitação</DialogTitle>
            <DialogDescription>Preencha os dados do edital para cadastrar uma nova licitação.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Construção da Escola Municipal" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edital">Nº do Edital</Label>
                <Input id="edital" value={form.edital_number} onChange={(e) => setForm({ ...form, edital_number: e.target.value })} placeholder="Ex: 001/2026" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Valor Estimado (R$)</Label>
                <Input id="value" type="number" step="0.01" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="opening">Data de Abertura</Label>
                <Input id="opening" type="date" value={form.opening_date} onChange={(e) => setForm({ ...form, opening_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Prazo Final</Label>
                <Input id="deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createBid.isPending}>{createBid.isPending ? "Salvando..." : "Cadastrar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
