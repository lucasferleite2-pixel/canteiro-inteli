import { useState, useRef, useMemo, useEffect } from "react";
import Papa from "papaparse";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2,
  FileDown, BookOpen, Lock, GitMerge, RefreshCw, Eye, Undo2, History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  RDO_CSV_COLUMNS, generateCsvTemplate, validateAndParseRow,
  type ParsedRdoRow, type RdoCsvRow,
} from "@/lib/rdoCsvSchema";
import {
  importRdoBatch, buildErrorCsv, computeDiffPreview, rollbackImport,
  type ImportResult, type MergeMode, type FieldChange,
} from "@/lib/rdoCsvImporter";

interface RdoCsvImportProps {
  obraId: string;
  companyId: string;
}

const MERGE_MODES: { value: MergeMode; icon: any; label: string; desc: string }[] = [
  {
    value: "preserve",
    icon: Lock,
    label: "🔒 Preservar (pular)",
    desc: "Mantém o RDO existente intacto e ignora a linha do CSV.",
  },
  {
    value: "complement",
    icon: GitMerge,
    label: "🔀 Complementar (merge — recomendado)",
    desc: "Preenche apenas campos vazios no banco. Conflitos preservam o valor existente e são listados.",
  },
  {
    value: "overwrite",
    icon: RefreshCw,
    label: "♻️ Sobrescrever (replace)",
    desc: "Substitui campos preenchidos no CSV. Campos vazios no CSV nunca apagam o banco.",
  },
];

export function RdoCsvImport({ obraId, companyId }: RdoCsvImportProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = useState<ParsedRdoRow[]>([]);
  const [mergeMode, setMergeMode] = useState<MergeMode>("complement");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ImportResult[]>([]);
  const [activeTab, setActiveTab] = useState("upload");

  // Diff preview
  const [diffMap, setDiffMap] = useState<Map<string, { dbRow: any; changes: FieldChange[]; conflicts: FieldChange[] }>>(new Map());
  const [diffOpenForDate, setDiffOpenForDate] = useState<string | null>(null);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [recentBatches, setRecentBatches] = useState<any[]>([]);

  // Recarrega diff ao mudar modo ou parsed
  useEffect(() => {
    if (parsed.length === 0) { setDiffMap(new Map()); return; }
    computeDiffPreview(parsed, obraId, mergeMode).then(setDiffMap);
  }, [parsed, mergeMode, obraId]);

  // Carrega últimos lotes para rollback
  const loadRecentBatches = async () => {
    const { data } = await supabase
      .from("rdo_import_log")
      .select("batch_id, created_at, action, merge_mode")
      .eq("obra_id", obraId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!data) return;
    const grouped = new Map<string, { batch_id: string; created_at: string; merge_mode: string; counts: Record<string, number> }>();
    for (const r of data as any[]) {
      const existing = grouped.get(r.batch_id) || { batch_id: r.batch_id, created_at: r.created_at, merge_mode: r.merge_mode, counts: {} };
      existing.counts[r.action] = (existing.counts[r.action] || 0) + 1;
      grouped.set(r.batch_id, existing);
    }
    setRecentBatches(Array.from(grouped.values()).slice(0, 10));
  };

  useEffect(() => { loadRecentBatches(); }, [obraId]);

  const stats = useMemo(() => {
    const total = parsed.length;
    const valid = parsed.filter((r) => r.errors.length === 0).length;
    const invalid = total - valid;
    const warnings = parsed.filter((r) => r.warnings.length > 0).length;
    const duplicates = Array.from(diffMap.keys()).length;
    const conflictRows = Array.from(diffMap.values()).filter((d) => d.conflicts.length > 0).length;
    return { total, valid, invalid, warnings, duplicates, conflictRows };
  }, [parsed, diffMap]);

  const downloadTemplate = () => {
    const csv = generateCsvTemplate();
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modelo_rdo_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Modelo CSV baixado", description: "Preencha as linhas a partir da linha 4." });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<RdoCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      delimitersToGuess: [",", ";", "\t"],
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const allRows = res.data as RdoCsvRow[];
        const filtered = allRows.filter((row, idx) => {
          const dataVal = (row.data || "").trim();
          if (!dataVal) return false;
          if (dataVal.startsWith("date") || dataVal.startsWith("\"date")) return false;
          if (idx === 0 && dataVal === "2025-03-15") return false;
          return true;
        });

        const parsedRows = filtered.map((row, i) => validateAndParseRow(row, i + 2));
        setParsed(parsedRows);
        setResults([]);
        setActiveTab("preview");

        if (parsedRows.length === 0) {
          toast({ variant: "destructive", title: "Nenhuma linha válida", description: "O arquivo não contém RDOs para importar." });
        } else {
          toast({ title: `${parsedRows.length} linha(s) carregada(s)`, description: "Revise no preview antes de confirmar." });
        }
      },
      error: (err) => {
        toast({ variant: "destructive", title: "Erro ao ler CSV", description: err.message });
      },
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (!user?.id) return;
    const validRows = parsed.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) {
      toast({ variant: "destructive", title: "Nada para importar", description: "Corrija os erros no CSV." });
      return;
    }

    setImporting(true);
    setProgress({ current: 0, total: validRows.length });
    const batchId = (crypto as any).randomUUID?.() || `${Date.now()}-${Math.random()}`;
    setLastBatchId(batchId);

    try {
      const res = await importRdoBatch(
        parsed,
        { obraId, companyId, userId: user.id, mergeMode, batchId },
        (current, total) => setProgress({ current, total })
      );
      setResults(res);
      setActiveTab("results");

      const created = res.filter((r) => r.status === "created").length;
      const merged = res.filter((r) => r.status === "merged").length;
      const overwritten = res.filter((r) => r.status === "overwritten").length;
      const skipped = res.filter((r) => r.status === "skipped").length;
      const failed = res.filter((r) => r.status === "failed").length;

      toast({
        title: "Importação concluída",
        description: `${created} criado(s), ${merged} mesclado(s), ${overwritten} sobrescrito(s), ${skipped} pulado(s), ${failed} falha(s).`,
      });

      queryClient.invalidateQueries({ queryKey: ["rdo_dia"] });
      queryClient.invalidateQueries({ queryKey: ["rdo_despesa_item_ca"] });
      loadRecentBatches();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro na importação", description: err.message });
    } finally {
      setImporting(false);
    }
  };

  const handleRollback = async (batchId: string) => {
    const res = await rollbackImport(batchId);
    toast({
      title: "Rollback concluído",
      description: `${res.deleted} RDO(s) apagado(s), ${res.restored} restaurado(s)${res.failed ? `, ${res.failed} falha(s)` : ""}.`,
    });
    queryClient.invalidateQueries({ queryKey: ["rdo_dia"] });
    loadRecentBatches();
  };

  const downloadErrorCsv = () => {
    const csv = buildErrorCsv(results, parsed);
    if (!csv) return;
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `erros_importacao_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setParsed([]);
    setResults([]);
    setActiveTab("upload");
    setLastBatchId(null);
  };

  const currentDiff = diffOpenForDate ? diffMap.get(diffOpenForDate) : null;
  const currentRow = diffOpenForDate ? parsed.find((r) => r.data.rdo.data === diffOpenForDate) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Importar RDO via Planilha CSV
        </CardTitle>
        <CardDescription className="text-xs">
          Crie ou complemente múltiplos RDOs com merge inteligente e auditoria reversível.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="instructions"><BookOpen className="h-3.5 w-3.5 mr-1" />Instruções</TabsTrigger>
            <TabsTrigger value="upload"><Upload className="h-3.5 w-3.5 mr-1" />Upload</TabsTrigger>
            <TabsTrigger value="preview" disabled={parsed.length === 0}>
              Preview {parsed.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px]">{parsed.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="results" disabled={results.length === 0}>Resultado</TabsTrigger>
            <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" />Histórico</TabsTrigger>
          </TabsList>

          {/* INSTRUÇÕES */}
          <TabsContent value="instructions" className="space-y-3 mt-4">
            <Alert>
              <BookOpen className="h-4 w-4" />
              <AlertTitle className="text-sm">Como preencher o CSV</AlertTitle>
              <AlertDescription className="text-xs space-y-2 mt-2">
                <p><strong>1.</strong> Cada linha = 1 RDO completo (1 dia de obra).</p>
                <p><strong>2.</strong> Sub-itens (atividades, materiais, despesas, ocorrências) são separados por <code className="bg-muted px-1 rounded">|</code>.</p>
                <p><strong>3.</strong> Campos dentro de um sub-item são separados por <code className="bg-muted px-1 rounded">;</code>.</p>
                <p><strong>4.</strong> Linhas 2 e 3 do template são informativas (tipo + exemplo) e são ignoradas.</p>
                <p><strong>5.</strong> Datas: AAAA-MM-DD ou DD/MM/AAAA. Decimais: vírgula ou ponto.</p>
              </AlertDescription>
            </Alert>

            <Alert className="border-primary/30 bg-primary/5">
              <GitMerge className="h-4 w-4" />
              <AlertTitle className="text-sm">Estratégia de merge para duplicatas</AlertTitle>
              <AlertDescription className="text-xs space-y-1 mt-2">
                <p>Ao detectar RDO existente para a mesma data, o sistema <strong>nunca sobrescreve cegamente</strong>. Escolha:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li><strong>🔒 Preservar:</strong> mantém o RDO existente, pula a linha.</li>
                  <li><strong>🔀 Complementar:</strong> preenche só campos vazios. Conflitos preservam o banco.</li>
                  <li><strong>♻️ Sobrescrever:</strong> substitui campos preenchidos. CSV vazio nunca apaga banco.</li>
                </ul>
                <p className="mt-2">Toda alteração é registrada em log auditável e pode ser revertida pela aba <strong>Histórico</strong>.</p>
              </AlertDescription>
            </Alert>

            <ScrollArea className="h-[300px] border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="text-xs">Coluna</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Obrig.</TableHead>
                    <TableHead className="text-xs">Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RDO_CSV_COLUMNS.map((c) => (
                    <TableRow key={c.key}>
                      <TableCell className="font-mono text-[11px]">{c.label}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{c.type}</TableCell>
                      <TableCell>
                        {c.required ? (
                          <Badge variant="destructive" className="text-[10px] h-4">sim</Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">não</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px]">{c.help}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          {/* UPLOAD */}
          <TabsContent value="upload" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <Download className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium text-sm">1. Baixe o modelo</p>
                    <p className="text-xs text-muted-foreground mt-1">Template com todas as colunas e exemplos</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" /> Baixar Modelo CSV
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <Upload className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium text-sm">2. Importe o CSV preenchido</p>
                    <p className="text-xs text-muted-foreground mt-1">UTF-8 com separador , ; ou tab</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> Selecionar Arquivo
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PREVIEW */}
          <TabsContent value="preview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <StatCard label="Total" value={stats.total} color="text-foreground" />
              <StatCard label="Válidas" value={stats.valid} color="text-primary" />
              <StatCard label="Erros" value={stats.invalid} color="text-destructive" />
              <StatCard label="Duplicatas" value={stats.duplicates} color="text-foreground" />
              <StatCard label="Conflitos" value={stats.conflictRows} color="text-amber-600 dark:text-amber-400" />
            </div>

            <div className="space-y-3 border rounded-md p-3">
              <Label className="text-sm font-medium">Estratégia para datas duplicadas</Label>
              <RadioGroup value={mergeMode} onValueChange={(v: any) => setMergeMode(v)}>
                {MERGE_MODES.map((m) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.value} className="flex items-start space-x-2 p-2 rounded hover:bg-muted/50">
                      <RadioGroupItem value={m.value} id={m.value} className="mt-1" />
                      <Label htmlFor={m.value} className="font-normal cursor-pointer flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Icon className="h-3.5 w-3.5" /> {m.label}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            <ScrollArea className="h-[350px] border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="text-xs w-12">#</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Duplicata?</TableHead>
                    <TableHead className="text-xs">Sub-itens</TableHead>
                    <TableHead className="text-xs">Mensagens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((row) => {
                    const hasErrors = row.errors.length > 0;
                    const subCount =
                      row.data.atividades.length + row.data.materiais.length +
                      row.data.despesas.length + row.data.ocorrencias.length;
                    const diff = diffMap.get(row.data.rdo.data);
                    const isDup = !!diff;
                    const hasConflicts = diff && diff.conflicts.length > 0;
                    return (
                      <TableRow key={row.rowNumber} className={hasErrors ? "bg-destructive/5" : isDup ? "bg-amber-500/5" : "bg-primary/5"}>
                        <TableCell className="text-xs font-mono">{row.rowNumber}</TableCell>
                        <TableCell>
                          {hasErrors ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </TableCell>
                        <TableCell className="text-xs">{row.data.rdo.data || "-"}</TableCell>
                        <TableCell className="text-xs">
                          {isDup ? (
                            <Button
                              size="sm" variant="ghost"
                              className="h-6 px-2 text-[11px] gap-1"
                              onClick={() => setDiffOpenForDate(row.data.rdo.data)}
                            >
                              <Eye className="h-3 w-3" />
                              {hasConflicts ? <span className="text-amber-600">⚠ {diff!.conflicts.length} conflito(s)</span> : <span>ver diff</span>}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">novo</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex gap-1 flex-wrap">
                            {row.data.atividades.length > 0 && <Badge variant="outline" className="text-[10px] h-4">A:{row.data.atividades.length}</Badge>}
                            {row.data.materiais.length > 0 && <Badge variant="outline" className="text-[10px] h-4">M:{row.data.materiais.length}</Badge>}
                            {row.data.despesas.length > 0 && <Badge variant="outline" className="text-[10px] h-4">D:{row.data.despesas.length}</Badge>}
                            {row.data.ocorrencias.length > 0 && <Badge variant="outline" className="text-[10px] h-4">O:{row.data.ocorrencias.length}</Badge>}
                            {subCount === 0 && <span className="text-muted-foreground">-</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.errors.map((e, i) => <div key={`e-${i}`} className="text-destructive">{e}</div>)}
                          {row.warnings.map((w, i) => <div key={`w-${i}`} className="text-muted-foreground">⚠ {w}</div>)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            {importing && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Importando...</span>
                  <span>{progress.current}/{progress.total}</span>
                </div>
                <Progress value={(progress.current / progress.total) * 100} />
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" onClick={reset} disabled={importing}>Cancelar</Button>
              <Button onClick={handleImport} disabled={importing || stats.valid === 0}>
                {importing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar ({stats.valid})</>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* RESULTADO */}
          <TabsContent value="results" className="space-y-4 mt-4">
            {(() => {
              const c = (s: ImportResult["status"]) => results.filter((r) => r.status === s).length;
              return (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <StatCard label="Criados" value={c("created")} color="text-primary" />
                  <StatCard label="Mesclados" value={c("merged")} color="text-foreground" />
                  <StatCard label="Sobrescritos" value={c("overwritten")} color="text-foreground" />
                  <StatCard label="Pulados" value={c("skipped")} color="text-muted-foreground" />
                  <StatCard label="Falhas" value={c("failed")} color="text-destructive" />
                </div>
              );
            })()}

            <ScrollArea className="h-[300px] border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="text-xs">Linha</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.rowNumber}>
                      <TableCell className="text-xs font-mono">{r.rowNumber}</TableCell>
                      <TableCell className="text-xs">{r.data}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.error || (
                          <>
                            {r.fieldChanges && r.fieldChanges.length > 0 && <span>{r.fieldChanges.length} campo(s) alterado(s) </span>}
                            {r.conflicts && r.conflicts.length > 0 && <span className="text-amber-600">⚠ {r.conflicts.length} conflito(s)</span>}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between gap-2 flex-wrap">
              {results.some((r) => r.status === "failed") && (
                <Button variant="outline" size="sm" onClick={downloadErrorCsv}>
                  <FileDown className="h-4 w-4 mr-2" /> CSV de erros
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                {lastBatchId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Undo2 className="h-4 w-4 mr-2" /> Reverter esta importação
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reverter importação?</AlertDialogTitle>
                        <AlertDialogDescription>
                          RDOs criados nesta importação serão apagados e os valores anteriores dos RDOs mesclados/sobrescritos serão restaurados. Esta ação é irreversível.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRollback(lastBatchId)}>Reverter</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button variant="outline" size="sm" onClick={reset}>Nova Importação</Button>
              </div>
            </div>
          </TabsContent>

          {/* HISTÓRICO */}
          <TabsContent value="history" className="space-y-3 mt-4">
            <Alert>
              <History className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Últimas importações desta obra. Use "Reverter" para desfazer um lote inteiro.
              </AlertDescription>
            </Alert>
            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="text-xs">Data/Hora</TableHead>
                    <TableHead className="text-xs">Modo</TableHead>
                    <TableHead className="text-xs">Operações</TableHead>
                    <TableHead className="text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentBatches.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">Nenhuma importação registrada</TableCell></TableRow>
                  ) : recentBatches.map((b) => (
                    <TableRow key={b.batch_id}>
                      <TableCell className="text-xs">{new Date(b.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline" className="text-[10px]">{b.merge_mode || "—"}</Badge></TableCell>
                      <TableCell className="text-xs">
                        <div className="flex gap-1 flex-wrap">
                          {Object.entries(b.counts).map(([action, count]: any) => (
                            <Badge key={action} variant="secondary" className="text-[10px]">{action}: {count}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 px-2">
                              <Undo2 className="h-3 w-3 mr-1" /> Reverter
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Reverter importação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação restaura os valores anteriores e apaga RDOs criados neste lote. Não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRollback(b.batch_id)}>Reverter</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* DIFF MODAL */}
      <Dialog open={!!diffOpenForDate} onOpenChange={(o) => !o && setDiffOpenForDate(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Diff de merge — {diffOpenForDate}</DialogTitle>
            <DialogDescription>
              Comparação entre o RDO existente no banco e os dados do CSV usando o modo <strong>{mergeMode}</strong>.
            </DialogDescription>
          </DialogHeader>
          {currentDiff && currentRow && (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Campo</TableHead>
                    <TableHead className="text-xs">Valor atual (banco)</TableHead>
                    <TableHead className="text-xs">Valor CSV</TableHead>
                    <TableHead className="text-xs">Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    "clima","fase_obra","risco_dia","equipe_total","horas_trabalhadas",
                    "percentual_fisico_dia","percentual_fisico_acumulado","quantidade_executada",
                    "unidade_medicao","produtividade_percentual","custo_dia","observacoes_gerais",
                  ].map((field) => {
                    const dbVal = currentDiff.dbRow[field];
                    const csvVal = (currentRow.data.rdo as any)[field];
                    const change = currentDiff.changes.find((c) => c.field === field);
                    const conflict = currentDiff.conflicts.find((c) => c.field === field);
                    let action = "manter atual";
                    let color = "text-muted-foreground";
                    if (conflict) {
                      action = conflict.action === "conflict_used_csv" ? "⚠ usar CSV" : "⚠ manter banco";
                      color = "text-amber-600 dark:text-amber-400";
                    } else if (change?.action === "filled") {
                      action = "preencher"; color = "text-primary";
                    } else if (change?.action === "replaced") {
                      action = "substituir"; color = "text-primary";
                    }
                    return (
                      <TableRow key={field}>
                        <TableCell className="text-xs font-mono">{field}</TableCell>
                        <TableCell className="text-xs">{dbVal ?? <span className="text-muted-foreground">vazio</span>}</TableCell>
                        <TableCell className="text-xs">{csvVal ?? <span className="text-muted-foreground">vazio</span>}</TableCell>
                        <TableCell className={`text-xs font-medium ${color}`}>{action}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiffOpenForDate(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="border rounded-md p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ImportResult["status"] }) {
  const config = {
    created: { label: "Criado", className: "bg-primary/10 text-primary border-primary/30" },
    merged: { label: "Mesclado", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
    overwritten: { label: "Sobrescrito", className: "bg-secondary text-secondary-foreground border-border" },
    skipped: { label: "Pulado", className: "bg-muted text-muted-foreground border-border" },
    failed: { label: "Falha", className: "bg-destructive/10 text-destructive border-destructive/30" },
  }[status];
  return <Badge variant="outline" className={`text-[10px] ${config.className}`}>{config.label}</Badge>;
}
