import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Sun, Cloud, CloudRain, CloudLightning, CloudSnow,
  Users, ChevronDown, ChevronRight, Pencil, Trash2,
  Lock, LockOpen, TrendingUp, AlertTriangle, DollarSign,
  Activity, Package, AlertCircle, Camera, ShieldAlert, Loader2, Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { RdoAtividadeTab } from "./tabs/RdoAtividadeTab";
import { RdoMaterialTab } from "./tabs/RdoMaterialTab";
import { RdoOcorrenciaTab } from "./tabs/RdoOcorrenciaTab";
import { RdoDespesaTab } from "./tabs/RdoDespesaTab";
import { RdoFotoTab } from "./tabs/RdoFotoTab";
import { RdoRiscoTab } from "./tabs/RdoRiscoTab";

const weatherMap: Record<string, { label: string; icon: any; color: string }> = {
  Ensolarado: { label: "Ensolarado", icon: Sun, color: "text-yellow-500" },
  Nublado: { label: "Nublado", icon: Cloud, color: "text-muted-foreground" },
  Chuvoso: { label: "Chuvoso", icon: CloudRain, color: "text-blue-500" },
  Tempestade: { label: "Tempestade", icon: CloudLightning, color: "text-orange-500" },
  "Neve/Frio": { label: "Neve/Frio", icon: CloudSnow, color: "text-cyan-500" },
  // Legacy values from old system
  ensolarado: { label: "Ensolarado", icon: Sun, color: "text-yellow-500" },
  nublado: { label: "Nublado", icon: Cloud, color: "text-muted-foreground" },
  chuvoso: { label: "Chuvoso", icon: CloudRain, color: "text-blue-500" },
  tempestade: { label: "Tempestade", icon: CloudLightning, color: "text-orange-500" },
  neve: { label: "Neve/Frio", icon: CloudSnow, color: "text-cyan-500" },
};

const riscoColors: Record<string, string> = {
  baixo: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  medio: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  "médio": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  alto: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

interface RdoDia {
  id: string;
  obra_id: string;
  company_id: string;
  data: string;
  clima: string;
  equipe_total: number;
  horas_trabalhadas: number;
  fase_obra: string;
  percentual_fisico_dia: number;
  percentual_fisico_acumulado: number;
  custo_dia: number;
  produtividade_percentual: number;
  risco_dia: string;
  observacoes_gerais: string | null;
  criado_por: string;
  is_locked: boolean;
}

interface Props {
  rdo: RdoDia;
  companyId: string;
  canModify: boolean;
  isAuthor: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function RdoSmartCard({ rdo, companyId, canModify, isAuthor, onEdit, onDelete }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const lockMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rdo_dia").update({ is_locked: true }).eq("id", rdo.id);
      if (error) throw error;
      // Register in audit log
      const { error: auditErr } = await supabase.from("rdo_audit_log").insert({
        rdo_dia_id: rdo.id,
        company_id: companyId,
        user_id: user!.id,
        action: "lock",
        changes: { is_locked: true, locked_at: new Date().toISOString() },
      });
      if (auditErr) throw auditErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rdo_dia"] });
      setShowLockConfirm(false);
      toast({ title: "RDO travado com sucesso!", description: "Este registro não pode mais ser editado." });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro ao travar", description: err.message }),
  });

  const weather = weatherMap[rdo.clima];
  const WeatherIcon = weather?.icon || Sun;
  const riskClass = riscoColors[rdo.risco_dia] || riscoColors.baixo;

  const formattedDate = (() => {
    try {
      return format(new Date(rdo.data + "T12:00:00"), "dd 'de' MMM, yyyy (EEEE)", { locale: ptBR });
    } catch { return rdo.data; }
  })();

  return (
    <Card className="overflow-hidden border transition-all hover:shadow-md">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none pb-2 hover:bg-muted/30 transition-colors">
            {/* Top row: date + actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-semibold text-sm">{formattedDate}</span>
                </div>
                {rdo.is_locked && (
                  <Badge variant="outline" className="gap-1 text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400">
                    <Lock className="h-3 w-3" /> Travado
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {/* Lock button: visible to author when not locked */}
                {isAuthor && !rdo.is_locked && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700" onClick={() => setShowLockConfirm(true)} title="Travar RDO">
                    <LockOpen className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canModify && (
                  <>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </>
                )}
              </div>
            </div>

            {/* KPI strip */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className="gap-1 text-xs">
                <WeatherIcon className={`h-3.5 w-3.5 ${weather?.color || ""}`} />
                {weather?.label || rdo.clima}
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs">
                <Users className="h-3 w-3" /> {rdo.equipe_total}
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs">
                <TrendingUp className="h-3 w-3" /> {rdo.percentual_fisico_dia}% dia
              </Badge>
              <Badge variant="outline" className="gap-1 text-xs">
                <TrendingUp className="h-3 w-3" /> {rdo.percentual_fisico_acumulado}% acum.
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs">
                <DollarSign className="h-3 w-3" /> R$ {Number(rdo.custo_dia).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </Badge>
              {rdo.produtividade_percentual > 0 && (
                <Badge variant={rdo.produtividade_percentual < 50 ? "destructive" : rdo.produtividade_percentual < 70 ? "outline" : "secondary"} className="gap-1 text-xs">
                  <Activity className="h-3 w-3" /> {rdo.produtividade_percentual}% prod.
                </Badge>
              )}
              <Badge className={`gap-1 text-xs border ${riskClass}`}>
                <AlertTriangle className="h-3 w-3" /> Risco {rdo.risco_dia}
              </Badge>
              {rdo.fase_obra && (
                <Badge variant="outline" className="text-xs">{rdo.fase_obra}</Badge>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-2 pb-4">
            {rdo.observacoes_gerais && (
              <p className="text-sm text-muted-foreground mb-3 italic">{rdo.observacoes_gerais}</p>
            )}
            <Tabs defaultValue="atividades" className="w-full">
              <TabsList className="w-full justify-start h-auto flex-wrap gap-1 bg-muted/50 p-1">
                <TabsTrigger value="atividades" className="gap-1 text-xs"><Activity className="h-3.5 w-3.5" /> Atividades</TabsTrigger>
                <TabsTrigger value="materiais" className="gap-1 text-xs"><Package className="h-3.5 w-3.5" /> Materiais & Custos</TabsTrigger>
                <TabsTrigger value="ocorrencias" className="gap-1 text-xs"><AlertCircle className="h-3.5 w-3.5" /> Ocorrências</TabsTrigger>
                <TabsTrigger value="despesas" className="gap-1 text-xs"><Receipt className="h-3.5 w-3.5" /> Despesas</TabsTrigger>
                <TabsTrigger value="fotos" className="gap-1 text-xs"><Camera className="h-3.5 w-3.5" /> Fotos</TabsTrigger>
                <TabsTrigger value="risco" className="gap-1 text-xs"><ShieldAlert className="h-3.5 w-3.5" /> Análise de Risco</TabsTrigger>
              </TabsList>
              <TabsContent value="atividades" className="mt-3">
                <RdoAtividadeTab rdoDiaId={rdo.id} companyId={companyId} canEdit={canModify} />
              </TabsContent>
              <TabsContent value="materiais" className="mt-3">
                <RdoMaterialTab rdoDiaId={rdo.id} companyId={companyId} canEdit={canModify} />
              </TabsContent>
              <TabsContent value="ocorrencias" className="mt-3">
                <RdoOcorrenciaTab rdoDiaId={rdo.id} companyId={companyId} canEdit={canModify} />
              </TabsContent>
              <TabsContent value="despesas" className="mt-3">
                <RdoDespesaTab rdoDiaId={rdo.id} companyId={companyId} canEdit={canModify} />
              </TabsContent>
              <TabsContent value="fotos" className="mt-3">
                <RdoFotoTab rdoDiaId={rdo.id} companyId={companyId} canEdit={canModify} />
              </TabsContent>
              <TabsContent value="risco" className="mt-3">
                <RdoRiscoTab rdoDiaId={rdo.id} companyId={companyId} rdo={rdo} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Lock confirmation dialog */}
      <AlertDialog open={showLockConfirm} onOpenChange={setShowLockConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Travar este RDO?</AlertDialogTitle>
            <AlertDialogDescription>
              Após o travamento, este registro não poderá mais ser editado ou excluído.
              Esta ação é irreversível e será registrada no log de auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => lockMutation.mutate()}
            >
              {lockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Lock className="mr-2 h-4 w-4" /> Travar RDO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
