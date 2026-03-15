import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, FileDown, Loader2, Plus, Trash2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { generateNaoConformidadePDF, NcItem, NcSeverity, NcCategory, NcPdfOptions } from "@/lib/naoConformidadePdfGenerator";

const SEVERITY_OPTIONS: { value: NcSeverity; label: string; color: string }[] = [
  { value: "leve", label: "Leve", color: "bg-green-500" },
  { value: "moderada", label: "Moderada", color: "bg-yellow-500" },
  { value: "grave", label: "Grave", color: "bg-orange-500" },
  { value: "critica", label: "Crítica", color: "bg-red-600" },
];

const CATEGORY_OPTIONS: { value: NcCategory; label: string }[] = [
  { value: "structural", label: "Estrutural" },
  { value: "waterproofing", label: "Impermeabilização" },
  { value: "electrical", label: "Elétrica" },
  { value: "fire_safety", label: "Segurança contra Incêndio" },
  { value: "materials", label: "Materiais" },
  { value: "safety", label: "Segurança do Trabalho" },
  { value: "geotechnical", label: "Geotécnica" },
  { value: "performance", label: "Desempenho" },
  { value: "environmental", label: "Meio Ambiente" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectName: string;
  projectAddress?: string;
}

function createEmptyItem(): NcItem {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    location: "",
    severity: "moderada",
    category: "structural",
    correctiveAction: "",
    deadline: "",
    responsible: "",
  };
}

export function NcReportDialog({ open, onOpenChange, projectName, projectAddress }: Props) {
  const { companyId, user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [items, setItems] = useState<NcItem[]>([createEmptyItem()]);
  const [municipality, setMunicipality] = useState("");
  const [additionalNorms, setAdditionalNorms] = useState("");
  const [conclusions, setConclusions] = useState("");

  // Company data
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [technicalResponsible, setTechnicalResponsible] = useState("");
  const [creaCau, setCreaCau] = useState("");
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState("#1E40AF");

  useEffect(() => {
    if (open && companyId) loadCompanyData();
    if (open && projectAddress) setMunicipality(projectAddress);
  }, [open, companyId, projectAddress]);

  const loadCompanyData = async () => {
    if (!companyId) return;
    const { data: company } = await supabase
      .from("companies")
      .select("name, address, phone, technical_responsible, crea_cau, brand_color, logo_url")
      .eq("id", companyId)
      .maybeSingle();
    if (!company) return;
    setCompanyName(company.name || "");
    setCompanyAddress(company.address || "");
    setCompanyPhone(company.phone || "");
    setTechnicalResponsible(company.technical_responsible || "");
    setCreaCau(company.crea_cau || "");
    setBrandColor(company.brand_color || "#1E40AF");
    if (company.logo_url) {
      try {
        const res = await fetch(company.logo_url);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      } catch { /* ignore */ }
    }
  };

  const addItem = () => setItems((prev) => [...prev, createEmptyItem()]);

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, partial: Partial<NcItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...partial } : i)));
  };

  const handleGenerate = async () => {
    const validItems = items.filter((i) => i.title.trim() && i.description.trim());
    if (validItems.length === 0) {
      toast({ variant: "destructive", title: "Preencha ao menos uma não conformidade", description: "Título e descrição são obrigatórios." });
      return;
    }

    setIsLoading(true);
    setProgress("Iniciando...");
    try {
      await generateNaoConformidadePDF(
        {
          projectName,
          municipality: municipality || undefined,
          companyName: companyName || undefined,
          companyAddress: companyAddress || undefined,
          companyPhone: companyPhone || undefined,
          technicalResponsible: technicalResponsible || undefined,
          creaCau: creaCau || undefined,
          userName: user?.email || undefined,
          logoBase64,
          brandColor,
          items: validItems,
          additionalNorms: additionalNorms || undefined,
          conclusions: conclusions || undefined,
          companyId: companyId || undefined,
        },
        (step) => setProgress(step)
      );
      toast({ title: "Laudo de Não Conformidade gerado com sucesso!" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao gerar PDF", description: err.message });
    } finally {
      setIsLoading(false);
      setProgress("");
    }
  };

  const severityCounts = { leve: 0, moderada: 0, grave: 0, critica: 0 };
  items.forEach((i) => { if (i.title) severityCounts[i.severity]++; });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Laudo de Não Conformidade
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Gere um laudo técnico com fundamentação normativa ABNT automaticamente.
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Summary badges */}
          {items.some((i) => i.title) && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">Resumo:</span>
              {severityCounts.critica > 0 && <Badge variant="destructive">{severityCounts.critica} Crítica(s)</Badge>}
              {severityCounts.grave > 0 && <Badge className="bg-orange-500 hover:bg-orange-600">{severityCounts.grave} Grave(s)</Badge>}
              {severityCounts.moderada > 0 && <Badge className="bg-yellow-500 text-yellow-950 hover:bg-yellow-600">{severityCounts.moderada} Moderada(s)</Badge>}
              {severityCounts.leve > 0 && <Badge className="bg-green-500 hover:bg-green-600">{severityCounts.leve} Leve(s)</Badge>}
            </div>
          )}

          {/* Municipality */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Município da Obra</Label>
            <Input
              placeholder="Ex: São Paulo - SP"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
            />
          </div>

          {/* NC Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Não Conformidades</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-3 w-3" /> Adicionar
              </Button>
            </div>

            {items.map((item, idx) => (
              <Card key={item.id} className="border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">NC-{String(idx + 1).padStart(3, "0")}</span>
                    {items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(item.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <Input
                    placeholder="Título da não conformidade"
                    value={item.title}
                    onChange={(e) => updateItem(item.id, { title: e.target.value })}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Categoria</Label>
                      <Select value={item.category} onValueChange={(v) => updateItem(item.id, { category: v as NcCategory })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORY_OPTIONS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Gravidade</Label>
                      <Select value={item.severity} onValueChange={(v) => updateItem(item.id, { severity: v as NcSeverity })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SEVERITY_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              <span className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${s.color}`} />
                                {s.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Input
                    placeholder="Localização (ex: Bloco A, 3º Pavimento)"
                    value={item.location}
                    onChange={(e) => updateItem(item.id, { location: e.target.value })}
                  />

                  <Textarea
                    placeholder="Descrição detalhada da não conformidade..."
                    value={item.description}
                    onChange={(e) => updateItem(item.id, { description: e.target.value })}
                    rows={3}
                  />

                  <Textarea
                    placeholder="Ação corretiva recomendada..."
                    value={item.correctiveAction}
                    onChange={(e) => updateItem(item.id, { correctiveAction: e.target.value })}
                    rows={2}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Responsável"
                      value={item.responsible}
                      onChange={(e) => updateItem(item.id, { responsible: e.target.value })}
                    />
                    <Input
                      placeholder="Prazo (ex: 15 dias)"
                      value={item.deadline}
                      onChange={(e) => updateItem(item.id, { deadline: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Additional fields */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Campos Opcionais</Label>
            <Textarea
              placeholder="Normas complementares (além das automáticas)..."
              value={additionalNorms}
              onChange={(e) => setAdditionalNorms(e.target.value)}
              rows={2}
            />
            <Textarea
              placeholder="Conclusões adicionais do perito..."
              value={conclusions}
              onChange={(e) => setConclusions(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={isLoading} variant="destructive">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
            {isLoading ? progress || "Gerando..." : "Gerar Laudo NC"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
