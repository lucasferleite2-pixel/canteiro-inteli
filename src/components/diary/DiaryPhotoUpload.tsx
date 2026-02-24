import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Camera, Loader2, X, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { compressImage, getGPSFromBrowser } from "@/lib/imageCompression";
import { useQueryClient } from "@tanstack/react-query";

interface DiaryPhotoUploadProps {
  entryId: string;
  projectId: string;
  companyId: string;
  contracts?: { id: string; name: string }[];
  onComplete?: () => void;
}

interface PendingFile {
  file: File;
  preview: string;
  description: string;
  activity: string;
  contractId: string;
}

export function DiaryPhotoUpload({ entryId, projectId, companyId, contracts = [], onComplete }: DiaryPhotoUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPending: PendingFile[] = files.map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
      description: "",
      activity: "",
      contractId: "",
    }));
    setPending((prev) => [...prev, ...newPending]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removePending = (idx: number) => {
    setPending((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const updatePending = (idx: number, field: keyof PendingFile, value: string) => {
    setPending((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const uploadAll = async () => {
    if (!user || pending.length === 0) return;
    setUploading(true);
    setProgress(0);

    const gps = await getGPSFromBrowser();
    let uploaded = 0;

    for (const item of pending) {
      try {
        const compressed = await compressImage(item.file);
        const ext = "jpg";
        const path = `${user.id}/${entryId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("diary-photos")
          .upload(path, compressed, { contentType: "image/jpeg" });

        if (uploadErr) throw uploadErr;

        const { error: metaErr } = await supabase.from("diary_photos").insert({
          diary_entry_id: entryId,
          company_id: companyId,
          project_id: projectId,
          uploaded_by: user.id,
          storage_path: path,
          file_name: item.file.name,
          file_size: compressed.size,
          mime_type: "image/jpeg",
          description: item.description || null,
          activity: item.activity || null,
          contract_id: item.contractId || null,
          latitude: gps?.latitude ?? null,
          longitude: gps?.longitude ?? null,
          captured_at: new Date().toISOString(),
        });

        if (metaErr) throw metaErr;
        uploaded++;
      } catch (err: any) {
        console.error("Upload error:", err);
        toast({ variant: "destructive", title: "Erro no upload", description: `${item.file.name}: ${err.message}` });
      }
      setProgress(Math.round(((uploaded) / pending.length) * 100));
    }

    // Cleanup
    pending.forEach((p) => URL.revokeObjectURL(p.preview));
    setPending([]);
    setUploading(false);
    setProgress(0);
    queryClient.invalidateQueries({ queryKey: ["diary_photos"] });
    toast({ title: `${uploaded} foto(s) enviada(s) com sucesso!` });
    onComplete?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Camera className="mr-2 h-4 w-4" />
          Selecionar Fotos
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
        {pending.length > 0 && (
          <span className="text-sm text-muted-foreground">{pending.length} foto(s) selecionada(s)</span>
        )}
      </div>

      {pending.length > 0 && (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {pending.map((item, idx) => (
            <div key={idx} className="flex gap-3 p-3 rounded-lg border bg-card">
              <div className="relative w-20 h-20 shrink-0">
                <img src={item.preview} alt="" className="w-full h-full object-cover rounded-md" />
                <button
                  type="button"
                  onClick={() => removePending(idx)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{item.file.name}</p>
                <Input
                  placeholder="Descrição técnica da foto"
                  value={item.description}
                  onChange={(e) => updatePending(idx, "description", e.target.value)}
                  className="h-8 text-sm"
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Atividade/serviço"
                    value={item.activity}
                    onChange={(e) => updatePending(idx, "activity", e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                  {contracts.length > 0 && (
                    <Select value={item.contractId} onValueChange={(v) => updatePending(idx, "contractId", v)}>
                      <SelectTrigger className="h-8 text-sm w-40">
                        <SelectValue placeholder="Contrato" />
                      </SelectTrigger>
                      <SelectContent>
                        {contracts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploading && <Progress value={progress} className="h-2" />}

      {pending.length > 0 && (
        <Button onClick={uploadAll} disabled={uploading} className="w-full">
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando... {progress}%
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Enviar {pending.length} foto(s)
            </>
          )}
        </Button>
      )}
    </div>
  );
}
