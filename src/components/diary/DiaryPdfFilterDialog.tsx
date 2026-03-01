import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PdfFilters {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  contractId: string;
  reportType: string;
  includePhotos: boolean;
  includeActivities: boolean;
  includeOccurrences: boolean;
  includeMaterials: boolean;
  includeTechnicalComments: boolean;
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
  const [filters, setFilters] = useState<PdfFilters>({
    dateFrom: undefined,
    dateTo: undefined,
    contractId: "",
    reportType: "custom",
    includePhotos: true,
    includeActivities: true,
    includeOccurrences: true,
    includeMaterials: true,
    includeTechnicalComments: true,
  });

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

          {/* Content toggles */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Conteúdo do Relatório</Label>
            <ToggleRow label="Fotos" checked={filters.includePhotos} onChange={(v) => update({ includePhotos: v })} />
            <ToggleRow label="Atividades" checked={filters.includeActivities} onChange={(v) => update({ includeActivities: v })} />
            <ToggleRow label="Ocorrências" checked={filters.includeOccurrences} onChange={(v) => update({ includeOccurrences: v })} />
            <ToggleRow label="Materiais" checked={filters.includeMaterials} onChange={(v) => update({ includeMaterials: v })} />
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
