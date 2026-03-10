import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileDown, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface PdfFilters {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  contractId: string;
  reportType: string;
  includePhotos: boolean;
  includeActivities: boolean;
  includeOccurrences: boolean;
  includeMaterials: boolean;
  includeDespesas: boolean;
  includeSideStamp: boolean;
  includeTechnicalComments: boolean;
  includeLogo: boolean;
  logoBase64: string | null;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  technicalResponsible: string;
  brandColor: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contracts: { id: string; name: string }[];
  onGenerate: (filters: PdfFilters) => void;
  isLoading: boolean;
  progress: string;
}

const reportTypes = [
  { value: "custom", label: "Personalizado" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "semiannual", label: "Semestral" },
  { value: "annual", label: "Anual" },
];

function getDateRange(type: string): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);

  switch (type) {
    case "weekly":
      from.setDate(from.getDate() - 7);
      break;
    case "biweekly":
      from.setDate(from.getDate() - 14);
      break;
    case "monthly":
      from.setMonth(from.getMonth() - 1);
      break;
    case "quarterly":
      from.setMonth(from.getMonth() - 3);
      break;
    case "semiannual":
      from.setMonth(from.getMonth() - 6);
      break;
    case "annual":
      from.setFullYear(from.getFullYear() - 1);
      break;
    default:
      return { from: undefined as any, to: undefined as any };
  }
  return { from, to };
}

export function DiaryPdfFilterDialog({ open, onOpenChange, contracts, onGenerate, isLoading, progress }: Props) {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Load company data when dialog opens
  useEffect(() => {
    if (open) loadCompanyData();
  }, [open, companyId]);

  const [filters, setFilters] = useState<PdfFilters>({
    dateFrom: undefined,
    dateTo: undefined,
    contractId: "",
    reportType: "custom",
    includePhotos: true,
    includeActivities: true,
    includeOccurrences: true,
    includeMaterials: true,
    includeDespesas: true,
    includeSideStamp: true,
    includeTechnicalComments: true,
    includeLogo: true,
    logoBase64: null,
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    technicalResponsible: "",
    brandColor: "#1E40AF",
  });

  const loadCompanyData = async () => {
    if (!companyId) return;
    const { data: company } = await supabase
      .from("companies")
      .select("logo_url, name, address, phone, technical_responsible, brand_color")
      .eq("id", companyId)
      .maybeSingle();
    if (!company) return;
    setFilters((f) => ({
      ...f,
      companyName: company.name || "",
      companyAddress: (company as any).address || "",
      companyPhone: (company as any).phone || "",
      technicalResponsible: (company as any).technical_responsible || "",
      brandColor: (company as any).brand_color || "#1E40AF",
    }));
    if (company.logo_url) {
      setLogoPreview(company.logo_url);
      try {
        const res = await fetch(company.logo_url);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const b64 = reader.result as string;
          setFilters((f) => ({ ...f, logoBase64: b64, includeLogo: true }));
        };
        reader.readAsDataURL(blob);
      } catch { /* ignore */ }
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Formato inválido", description: "Envie uma imagem (PNG, JPG, SVG)." });
      return;
    }
    setLogoUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${companyId}/logo.${ext}`;
      await supabase.storage.from("company-logos").upload(path, file, { upsert: true });
      const { data: urlData } = supabase.storage.from("company-logos").getPublicUrl(path);
      const logoUrl = urlData.publicUrl + "?t=" + Date.now();
      await supabase.from("companies").update({ logo_url: logoUrl }).eq("id", companyId);
      setLogoPreview(logoUrl);
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilters((f) => ({ ...f, logoBase64: reader.result as string, includeLogo: true }));
      };
      reader.readAsDataURL(file);
      toast({ title: "Logo enviado com sucesso!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao enviar logo", description: err.message });
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeLogo = () => {
    setLogoPreview(null);
    setFilters((f) => ({ ...f, logoBase64: null, includeLogo: false }));
  };

  const handleReportTypeChange = (type: string) => {
    if (type !== "custom") {
      const { from, to } = getDateRange(type);
      setFilters((f) => ({ ...f, reportType: type, dateFrom: from, dateTo: to }));
    } else {
      setFilters((f) => ({ ...f, reportType: type, dateFrom: undefined, dateTo: undefined }));
    }
  };

  const update = (partial: Partial<PdfFilters>) => setFilters((f) => ({ ...f, ...partial }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Relatório PDF</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Report type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de Relatório</Label>
            <Select value={filters.reportType} onValueChange={handleReportTypeChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {reportTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Data Inicial</Label>
              <DatePicker date={filters.dateFrom} onSelect={(d) => update({ dateFrom: d })} disabled={filters.reportType !== "custom"} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Data Final</Label>
              <DatePicker date={filters.dateTo} onSelect={(d) => update({ dateTo: d })} disabled={filters.reportType !== "custom"} />
            </div>
          </div>

          {/* Contract filter */}
          {contracts.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Filtrar por Contrato</Label>
              <Select value={filters.contractId} onValueChange={(v) => update({ contractId: v })}>
                <SelectTrigger><SelectValue placeholder="Todos os contratos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os contratos</SelectItem>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Company details */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Dados da Empresa (Capa)</Label>
            <div className="space-y-2">
              <Input placeholder="Endereço" value={filters.companyAddress} onChange={(e) => update({ companyAddress: e.target.value })} />
              <Input placeholder="Telefone" value={filters.companyPhone} onChange={(e) => update({ companyPhone: e.target.value })} />
              <Input placeholder="Responsável Técnico" value={filters.technicalResponsible} onChange={(e) => update({ technicalResponsible: e.target.value })} />
            </div>
          </div>

          {/* Brand color */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Cor Primária do Relatório</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={filters.brandColor}
                onChange={(e) => update({ brandColor: e.target.value })}
                className="h-9 w-12 rounded border border-border cursor-pointer bg-transparent p-0.5"
              />
              <Input
                value={filters.brandColor}
                onChange={(e) => update({ brandColor: e.target.value })}
                className="w-28 font-mono text-sm uppercase"
                maxLength={7}
                placeholder="#1E40AF"
              />
              <span className="text-xs text-muted-foreground">Capa, títulos e tabelas</span>
            </div>
          </div>

          {/* Company logo */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Logotipo da Empresa</Label>
            <div className="flex items-center gap-3">
              {logoPreview ? (
                <div className="relative">
                  <img src={logoPreview} alt="Logo" className="h-12 w-auto max-w-[120px] object-contain rounded border p-1" />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={logoUploading}
              >
                {logoUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {logoPreview ? "Trocar Logo" : "Enviar Logo"}
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
            {logoPreview && (
              <ToggleRow label="Incluir logo na capa" checked={filters.includeLogo} onChange={(v) => update({ includeLogo: v })} />
            )}
          </div>

          {/* Content toggles */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Conteúdo do Relatório</Label>
            <ToggleRow label="Fotos" checked={filters.includePhotos} onChange={(v) => update({ includePhotos: v })} />
            <ToggleRow label="Atividades" checked={filters.includeActivities} onChange={(v) => update({ includeActivities: v })} />
            <ToggleRow label="Ocorrências" checked={filters.includeOccurrences} onChange={(v) => update({ includeOccurrences: v })} />
            <ToggleRow label="Materiais" checked={filters.includeMaterials} onChange={(v) => update({ includeMaterials: v })} />
            <ToggleRow label="Despesas" checked={filters.includeDespesas} onChange={(v) => update({ includeDespesas: v })} />
            <ToggleRow label="Carimbo Lateral de Status" checked={filters.includeSideStamp} onChange={(v) => update({ includeSideStamp: v })} />
            <ToggleRow label="Comentários Técnicos" checked={filters.includeTechnicalComments} onChange={(v) => update({ includeTechnicalComments: v })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
          <Button onClick={() => onGenerate(filters)} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            {isLoading ? progress || "Gerando..." : "Gerar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function DatePicker({ date, onSelect, disabled }: { date: Date | undefined; onSelect: (d: Date | undefined) => void; disabled?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")} disabled={disabled}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy") : "Selecione"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
      </PopoverContent>
    </Popover>
  );
}
