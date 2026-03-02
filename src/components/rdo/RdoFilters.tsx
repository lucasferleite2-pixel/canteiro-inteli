import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface RdoFilterValues {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  fase: string;
  risco: string;
  tipoOcorrencia: string;
  tipoMaterial: string;
  apenasRiscoAlto: boolean;
  apenasCustoNaoPrevisto: boolean;
}

const defaultFilters: RdoFilterValues = {
  dateFrom: undefined,
  dateTo: undefined,
  fase: "",
  risco: "",
  tipoOcorrencia: "",
  tipoMaterial: "",
  apenasRiscoAlto: false,
  apenasCustoNaoPrevisto: false,
};

const fases = ["Fundação", "Estrutura", "Alvenaria", "Cobertura", "Instalações", "Acabamento", "Pavimentação", "Demolição"];
const riscos = ["baixo", "médio", "alto"];

interface Props {
  filters: RdoFilterValues;
  onChange: (f: RdoFilterValues) => void;
}

export function RdoFilters({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const hasActive = filters.dateFrom || filters.dateTo || filters.fase || filters.risco || filters.tipoOcorrencia || filters.tipoMaterial || filters.apenasRiscoAlto || filters.apenasCustoNaoPrevisto;
  const activeCount = [filters.dateFrom, filters.dateTo, filters.fase, filters.risco, filters.tipoOcorrencia, filters.tipoMaterial, filters.apenasRiscoAlto, filters.apenasCustoNaoPrevisto].filter(Boolean).length;

  const update = (partial: Partial<RdoFilterValues>) => onChange({ ...filters, ...partial });
  const clear = () => onChange(defaultFilters);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {activeCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activeCount}</Badge>
            )}
          </Button>
        </CollapsibleTrigger>
        {hasActive && (
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={clear}>
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      <CollapsibleContent className="mt-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg border bg-muted/30">
          {/* Date from */}
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <DatePick date={filters.dateFrom} onSelect={(d) => update({ dateFrom: d })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <DatePick date={filters.dateTo} onSelect={(d) => update({ dateTo: d })} />
          </div>

          {/* Fase */}
          <div className="space-y-1">
            <Label className="text-xs">Fase da Obra</Label>
            <Select value={filters.fase} onValueChange={(v) => update({ fase: v === "all" ? "" : v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {fases.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Risco */}
          <div className="space-y-1">
            <Label className="text-xs">Risco</Label>
            <Select value={filters.risco} onValueChange={(v) => update({ risco: v === "all" ? "" : v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {riscos.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export { defaultFilters };

function DatePick({ date, onSelect }: { date: Date | undefined; onSelect: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal h-8 text-xs", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-1.5 h-3 w-3" />
          {date ? format(date, "dd/MM/yyyy") : "Selecione"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
      </PopoverContent>
    </Popover>
  );
}
