import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export interface ObraFormData {
  name: string;
  description: string;
  address: string;
  municipality: string;
  budget: string;
  start_date: string;
  expected_end_date: string;
  status: string;
}

const EMPTY_FORM: ObraFormData = {
  name: "",
  description: "",
  address: "",
  municipality: "",
  budget: "",
  start_date: "",
  expected_end_date: "",
  status: "planning",
};

interface ObraFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ObraFormData) => void;
  isPending: boolean;
  initialData?: ObraFormData | null;
  mode?: "create" | "edit";
}

export function ObraFormDialog({ open, onOpenChange, onSubmit, isPending, initialData, mode = "create" }: ObraFormDialogProps) {
  const [form, setForm] = useState<ObraFormData>(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setForm(initialData ?? EMPTY_FORM);
    }
  }, [open, initialData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Editar Obra" : "Nova Obra"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
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
            <Label>Endereço Completo</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro" />
          </div>
          <div className="space-y-2">
            <Label>Município / UF</Label>
            <Input value={form.municipality} onChange={(e) => setForm({ ...form, municipality: e.target.value })} placeholder="Ex: São Paulo - SP" />
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
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "edit" ? "Salvar Alterações" : "Criar Obra"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
