import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Database, Building2, ClipboardList, FileText, DollarSign, Gavel, Bell, HardHat, Loader2, CheckCircle, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";

const MODULES = [
  { key: "company", label: "Empresa", icon: Building2, table: "companies", single: true },
  { key: "profiles", label: "Perfis", icon: Building2, table: "profiles" },
  { key: "projects", label: "Obras / Projetos", icon: HardHat, table: "projects" },
  { key: "diary_entries", label: "Diário de Obra", icon: ClipboardList, table: "diary_entries" },
  { key: "contracts", label: "Contratos", icon: FileText, table: "contracts" },
  { key: "financial_records", label: "Financeiro", icon: DollarSign, table: "financial_records" },
  { key: "bids", label: "Licitações", icon: Gavel, table: "bids" },
  { key: "alerts", label: "Alertas", icon: Bell, table: "alerts" },
  { key: "rdo_dia", label: "RDOs Diários", icon: ClipboardList, table: "rdo_dia" },
  { key: "rdo_atividade", label: "Atividades RDO", icon: ClipboardList, table: "rdo_atividade" },
  { key: "rdo_material", label: "Materiais RDO", icon: ClipboardList, table: "rdo_material" },
  { key: "rdo_despesa_item", label: "Despesas RDO", icon: DollarSign, table: "rdo_despesa_item" },
  { key: "rdo_ocorrencia", label: "Ocorrências RDO", icon: Bell, table: "rdo_ocorrencia" },
  { key: "rdo_foto", label: "Fotos RDO", icon: ClipboardList, table: "rdo_foto" },
] as const;

type ModuleKey = typeof MODULES[number]["key"];

async function fetchTableData(table: string, companyId: string, single: boolean = false) {
  const companyCol = table === "companies" ? "id" : "company_id";
  if (single) {
    const { data, error } = await (supabase as any).from(table).select("*").eq(companyCol, companyId).maybeSingle();
    if (error) throw error;
    return data;
  }
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select("*")
      .eq(companyCol, companyId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}

function downloadJson(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
}

export default function ExportarDados() {
  const { companyId, user, isDemo } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentModule, setCurrentModule] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [individualExporting, setIndividualExporting] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) {
      setIsAdmin(true);
      setCompanyName("Empresa Demo");
      return;
    }
    if (!user || !companyId) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .then(({ data }) => {
        setIsAdmin(data?.some((r) => r.role === "admin") ?? false);
      });
    supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        setCompanyName(data?.name ?? "empresa");
      });
  }, [user, companyId, isDemo]);

  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldAlert className="h-16 w-16 text-destructive/60" />
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Apenas administradores podem acessar esta página.</p>
      </div>
    );
  }

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleExportAll = async () => {
    if (!companyId) return;
    setExporting(true);
    setProgress(0);
    try {
      const result: Record<string, any> = {
        export_version: "1.0",
        exported_at: new Date().toISOString(),
      };
      for (let i = 0; i < MODULES.length; i++) {
        const mod = MODULES[i];
        setCurrentModule(mod.label);
        setProgress(Math.round(((i) / MODULES.length) * 100));
        const data = await fetchTableData(mod.table, companyId, mod.key === "company");
        result[mod.key] = data;
      }
      setProgress(100);
      setCurrentModule("Concluído!");
      const date = new Date().toISOString().split("T")[0];
      downloadJson(result, `export_${sanitizeFilename(companyName)}_${date}.json`);
      toast({ title: "Exportação concluída", description: "Arquivo JSON baixado com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro na exportação", description: err.message, variant: "destructive" });
    } finally {
      setTimeout(() => {
        setExporting(false);
        setProgress(0);
        setCurrentModule("");
      }, 1500);
    }
  };

  const handleExportModule = async (mod: typeof MODULES[number]) => {
    if (!companyId) return;
    setIndividualExporting(mod.key);
    try {
      const data = await fetchTableData(mod.table, companyId, mod.key === "company");
      const date = new Date().toISOString().split("T")[0];
      downloadJson(
        { export_version: "1.0", exported_at: new Date().toISOString(), [mod.key]: data },
        `export_${sanitizeFilename(companyName)}_${mod.key}_${date}.json`
      );
      toast({ title: `${mod.label} exportado`, description: "Arquivo baixado." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIndividualExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Exportação de Dados</h1>
        <p className="text-muted-foreground">Exporte todos os dados da sua conta em formato JSON.</p>
      </div>

      {/* Export All */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Exportação Completa
          </CardTitle>
          <CardDescription>Baixe um arquivo JSON com todos os dados da empresa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {exporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Coletando: {currentModule}</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          )}
          <Button onClick={handleExportAll} disabled={exporting} size="lg" className="w-full sm:w-auto">
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exportar Todos os Dados
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Individual modules */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Exportar por Módulo</CardTitle>
          <CardDescription>Exporte dados de cada módulo separadamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              const isLoading = individualExporting === mod.key;
              return (
                <Button
                  key={mod.key}
                  variant="outline"
                  className="justify-start h-auto py-3 px-4"
                  disabled={isLoading || exporting}
                  onClick={() => handleExportModule(mod)}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="mr-2 h-4 w-4 text-primary" />
                  )}
                  <span className="truncate">{mod.label}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
