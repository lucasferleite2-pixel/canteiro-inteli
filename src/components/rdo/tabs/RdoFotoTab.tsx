import { useState, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ImageIcon, Upload, X, Trash2, CalendarIcon, Pencil, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { compressImage, getGPSFromBrowser } from "@/lib/imageCompression";

interface Props {
  rdoDiaId: string;
  companyId: string;
  canEdit: boolean;
}

const faseOptions = ["Fundação", "Estrutura", "Alvenaria", "Instalações", "Acabamento", "Cobertura", "Infraestrutura", "Paisagismo"];
const tagRiscoOptions = [
  { value: "nenhuma", label: "Nenhuma" },
  { value: "técnico", label: "Técnico" },
  { value: "segurança", label: "Segurança" },
  { value: "contratual", label: "Contratual" },
];

export function RdoFotoTab({ rdoDiaId, companyId, canEdit }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [displayNames, setDisplayNames] = useState<string[]>([]);
  const [capturedDates, setCapturedDates] = useState<Date[]>([]);
  const [descricao, setDescricao] = useState("");
  const [faseObra, setFaseObra] = useState("");
  const [tagRisco, setTagRisco] = useState("nenhuma");
  const [uploading, setUploading] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editDate, setEditDate] = useState<Date>(new Date());

  const { data: fotos = [], isLoading } = useQuery({
    queryKey: ["rdo_foto", rdoDiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rdo_foto")
        .select("*")
        .eq("rdo_dia_id", rdoDiaId)
        .order("created_at");
      if (error) throw error;
      return data.map((f: any) => {
        const { data: urlData } = supabase.storage.from("diary-photos").getPublicUrl(f.storage_path);
        return { ...f, url: urlData.publicUrl };
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (foto: any) => {
      await supabase.storage.from("diary-photos").remove([foto.storage_path]);
      const { error } = await supabase.from("rdo_foto").delete().eq("id", foto.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rdo_foto", rdoDiaId] });
      toast({ title: "Foto removida." });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setSelectedFiles(files);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
    setDisplayNames(files.map((f) => f.name.replace(/\.[^/.]+$/, "")));
    setCapturedDates(files.map(() => new Date()));
    setShowUpload(true);
  };

  const clearForm = () => {
    setSelectedFiles([]);
    previews.forEach(URL.revokeObjectURL);
    setPreviews([]);
    setDisplayNames([]);
    setCapturedDates([]);
    setDescricao("");
    setFaseObra("");
    setTagRisco("nenhuma");
    setShowUpload(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const hasEmptyNames = displayNames.some((n) => !n.trim());

  const handleUpload = async () => {
    if (!user || selectedFiles.length === 0) return;
    if (hasEmptyNames) {
      toast({ variant: "destructive", title: "Nome obrigatório", description: "Preencha o nome de todas as fotos antes de enviar." });
      return;
    }
    setUploading(true);
    try {
      const gps = await getGPSFromBrowser();

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const compressed = await compressImage(file);
        const ext = compressed.name.split(".").pop() || "jpg";
        const path = `${companyId}/${rdoDiaId}/${crypto.randomUUID()}.${ext}`;

        const { error: storageErr } = await supabase.storage.from("diary-photos").upload(path, compressed);
        if (storageErr) throw storageErr;

        const { error: dbErr } = await supabase.from("rdo_foto").insert({
          rdo_dia_id: rdoDiaId,
          company_id: companyId,
          file_name: displayNames[i] || file.name,
          storage_path: path,
          descricao: descricao || null,
          fase_obra: faseObra || null,
          tag_risco: tagRisco,
          uploaded_by: user.id,
          latitude: gps?.latitude ?? null,
          longitude: gps?.longitude ?? null,
          data_captura: capturedDates[i]?.toISOString() || new Date().toISOString(),
        });
        if (dbErr) throw dbErr;
      }

      queryClient.invalidateQueries({ queryKey: ["rdo_foto", rdoDiaId] });
      toast({ title: `${selectedFiles.length} foto(s) enviada(s) com sucesso!` });
      clearForm();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro no upload", description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const tagColors: Record<string, string> = {
    nenhuma: "",
    "técnico": "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    "segurança": "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    contratual: "bg-red-500/10 text-red-700 dark:text-red-400",
  };

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Upload button */}
      {canEdit && !showUpload && (
        <div className="flex justify-center">
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Adicionar fotos
          </Button>
        </div>
      )}

      {/* Upload form */}
      {showUpload && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Upload de fotos ({selectedFiles.length})</h4>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearForm}><X className="h-4 w-4" /></Button>
          </div>

          {/* Per-file name & date */}
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {selectedFiles.map((file, i) => (
              <div key={i} className="flex gap-2 items-center p-2 rounded border bg-card">
                <img src={previews[i]} alt="" className="h-12 w-12 rounded object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input
                    value={displayNames[i] || ""}
                    onChange={(e) => setDisplayNames((prev) => prev.map((n, j) => j === i ? e.target.value : n))}
                    className={cn("h-7 text-sm", !displayNames[i]?.trim() && "border-destructive")}
                    placeholder="Nome da foto"
                  />
                </div>
                <div className="w-36 shrink-0">
                  <Label className="text-xs text-muted-foreground">Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("h-7 w-full justify-start text-left text-xs font-normal")}>
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {format(capturedDates[i] || new Date(), "dd/MM/yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={capturedDates[i]}
                        onSelect={(date) => {
                          if (date) setCapturedDates((prev) => prev.map((d, j) => j === i ? date : d));
                        }}
                        locale={ptBR}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição técnica da foto..." rows={2} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs">Fase da obra</Label>
              <Select value={faseObra} onValueChange={setFaseObra}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {faseOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tag de risco</Label>
              <Select value={tagRisco} onValueChange={setTagRisco}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tagRiscoOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleUpload} disabled={uploading} className="w-full">
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {uploading ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery */}
      {fotos.length === 0 && !showUpload ? (
        <div className="text-center py-6 text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhuma foto neste registro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {fotos.map((f: any) => (
            <div key={f.id} className="relative group rounded-md overflow-hidden border">
              <img src={f.url} alt={f.descricao || f.file_name} className="w-full aspect-square object-cover" loading="lazy" />
              {canEdit && (
                <button
                  onClick={() => deleteMutation.mutate(f)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                {f.file_name && <p className="text-[10px] text-white font-medium truncate">{f.file_name}</p>}
                {f.data_captura && (
                  <p className="text-[9px] text-white/80">{format(new Date(f.data_captura), "dd/MM/yyyy", { locale: ptBR })}</p>
                )}
                {f.descricao && <p className="text-[10px] text-white/90 line-clamp-1 mt-0.5">{f.descricao}</p>}
                <div className="flex gap-1 mt-0.5">
                  {f.fase_obra && <Badge variant="secondary" className="text-[8px] h-4">{f.fase_obra}</Badge>}
                  {f.tag_risco && f.tag_risco !== "nenhuma" && (
                    <Badge className={`text-[8px] h-4 ${tagColors[f.tag_risco] || ""}`}>{f.tag_risco}</Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
