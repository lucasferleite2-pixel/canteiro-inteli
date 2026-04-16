import { useState, useRef, useMemo } from "react";
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
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2, FileDown, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { RDO_CSV_COLUMNS, generateCsvTemplate, validateAndParseRow, type ParsedRdoRow, type RdoCsvRow } from "@/lib/rdoCsvSchema";
import { importRdoBatch, buildErrorCsv, type ImportResult } from "@/lib/rdoCsvImporter";

interface RdoCsvImportProps {
  obraId: string;
  companyId: string;
}

export function RdoCsvImport({ obraId, companyId }: RdoCsvImportProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = useState<ParsedRdoRow[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "overwrite">("skip");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ImportResult[]>([]);
  const [activeTab, setActiveTab] = useState("upload");

  const stats = useMemo(() => {
    const total = parsed.length;
    const valid = parsed.filter((r) => r.errors.length === 0).length;
    const invalid = total - valid;
    const warnings = parsed.filter((r) => r.warnings.length > 0).length;
    return { total, valid, invalid, warnings };
  }, [parsed]);

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
        // Filtrar linhas de "tipo" e "exemplo" do template (heurística: se data for inválida E todos campos vazios ou for "date")
        const allRows = res.data as RdoCsvRow[];
        const filtered = allRows.filter((row, idx) => {
          // Pular se contém marcadores de tipo do template
          const dataVal = (row.data || "").trim();
          if (!dataVal) return false;
          if (dataVal.startsWith("date") || dataVal.startsWith("\"date")) return false;
          if (idx === 0 && dataVal === "2025-03-15") return false; // exemplo
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

    try {
      const res = await importRdoBatch(
        parsed,
        { obraId, companyId, userId: user.id, duplicateStrategy },
        (current, total) => setProgress({ current, total })
      );
      setResults(res);
      setActiveTab("results");

      const created = res.filter((r) => r.status === "created").length;
      const overwritten = res.filter((r) => r.status === "overwritten").length;
      const failed = res.filter((r) => r.status === "failed").length;

      toast({
        title: "Importação concluída",
        description: `${created} criado(s), ${overwritten} sobrescrito(s), ${failed} falha(s).`,
      });

      queryClient.invalidateQueries({ queryKey: ["rdo_dia"] });
      queryClient.invalidateQueries({ queryKey: ["rdo_despesa_item_ca"] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro na importação", description: err.message });
    } finally {
      setImporting(false);
    }
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
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Importar RDO via Planilha CSV
        </CardTitle>
        <CardDescription className="text-xs">
          Crie múltiplos RDOs de uma vez. Baixe o modelo, preencha e faça o upload.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="instructions"><BookOpen className="h-3.5 w-3.5 mr-1" />Instruções</TabsTrigger>
            <TabsTrigger value="upload"><Upload className="h-3.5 w-3.5 mr-1" />Upload</TabsTrigger>
            <TabsTrigger value="preview" disabled={parsed.length === 0}>
              Preview {parsed.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px]">{parsed.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="results" disabled={results.length === 0}>Resultado</TabsTrigger>
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
                <p><strong>4.</strong> Linhas 2 e 3 do template são informativas (tipo + exemplo) e são ignoradas na importação.</p>
                <p><strong>5.</strong> Datas: use AAAA-MM-DD ou DD/MM/AAAA. Decimais: use vírgula (1,5) ou ponto (1.5).</p>
              </AlertDescription>
            </Alert>

            <ScrollArea className="h-[400px] border rounded-md">
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
                    <p className="text-xs text-muted-foreground mt-1">Template com todas as colunas e exemplos preenchidos</p>
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
                    <p className="text-xs text-muted-foreground mt-1">Aceita UTF-8 com separador , ; ou tab</p>
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

            <Alert className="border-primary/30 bg-primary/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Veja a aba <strong>Instruções</strong> para entender o formato dos sub-itens (atividades, despesas, etc.).
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* PREVIEW */}
          <TabsContent value="preview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatCard label="Total" value={stats.total} color="text-foreground" />
              <StatCard label="Válidas" value={stats.valid} color="text-primary" />
              <StatCard label="Com erros" value={stats.invalid} color="text-destructive" />
              <StatCard label="Avisos" value={stats.warnings} color="text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Estratégia para datas duplicadas</Label>
              <RadioGroup value={duplicateStrategy} onValueChange={(v: any) => setDuplicateStrategy(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="skip" id="skip" />
                  <Label htmlFor="skip" className="text-sm font-normal cursor-pointer">
                    Pular duplicatas (manter RDOs existentes)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="overwrite" id="overwrite" />
                  <Label htmlFor="overwrite" className="text-sm font-normal cursor-pointer">
                    Sobrescrever (substitui RDO + sub-itens existentes)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <ScrollArea className="h-[350px] border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="text-xs w-12">#</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Clima</TableHead>
                    <TableHead className="text-xs">Equipe</TableHead>
                    <TableHead className="text-xs">Fase</TableHead>
                    <TableHead className="text-xs">Sub-itens</TableHead>
                    <TableHead className="text-xs">Mensagens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((row) => {
                    const hasErrors = row.errors.length > 0;
                    const subCount =
                      row.data.atividades.length +
                      row.data.materiais.length +
                      row.data.despesas.length +
                      row.data.ocorrencias.length;
                    return (
                      <TableRow key={row.rowNumber} className={hasErrors ? "bg-destructive/5" : "bg-primary/5"}>
                        <TableCell className="text-xs font-mono">{row.rowNumber}</TableCell>
                        <TableCell>
                          {hasErrors ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{row.data.rdo.data || "-"}</TableCell>
                        <TableCell className="text-xs">{row.data.rdo.clima}</TableCell>
                        <TableCell className="text-xs">{row.data.rdo.equipe_total}</TableCell>
                        <TableCell className="text-xs">{row.data.rdo.fase_obra || "-"}</TableCell>
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
                          {row.errors.map((e, i) => (
                            <div key={`e-${i}`} className="text-destructive">{e}</div>
                          ))}
                          {row.warnings.map((w, i) => (
                            <div key={`w-${i}`} className="text-muted-foreground">⚠ {w}</div>
                          ))}
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
              <Button variant="outline" size="sm" onClick={reset} disabled={importing}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={importing || stats.valid === 0}>
                {importing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar Importação ({stats.valid})</>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* RESULTADO */}
          <TabsContent value="results" className="space-y-4 mt-4">
            {(() => {
              const created = results.filter((r) => r.status === "created").length;
              const overwritten = results.filter((r) => r.status === "overwritten").length;
              const skipped = results.filter((r) => r.status === "skipped").length;
              const failed = results.filter((r) => r.status === "failed").length;
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <StatCard label="Criados" value={created} color="text-primary" />
                  <StatCard label="Sobrescritos" value={overwritten} color="text-foreground" />
                  <StatCard label="Pulados" value={skipped} color="text-muted-foreground" />
                  <StatCard label="Falhas" value={failed} color="text-destructive" />
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
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.error || "OK"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between gap-2">
              {results.some((r) => r.status === "failed") && (
                <Button variant="outline" size="sm" onClick={downloadErrorCsv}>
                  <FileDown className="h-4 w-4 mr-2" /> Baixar CSV de erros
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={reset} className="ml-auto">
                Nova Importação
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
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
    overwritten: { label: "Sobrescrito", className: "bg-secondary text-secondary-foreground border-border" },
    skipped: { label: "Pulado", className: "bg-muted text-muted-foreground border-border" },
    failed: { label: "Falha", className: "bg-destructive/10 text-destructive border-destructive/30" },
  }[status];
  return <Badge variant="outline" className={`text-[10px] ${config.className}`}>{config.label}</Badge>;
}
