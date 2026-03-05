import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, MapPin, Loader2, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DiaryPhotoGalleryProps {
  entryId: string;
  companyId: string;
  compact?: boolean;
}

export function DiaryPhotoGallery({ entryId, companyId, compact = false }: DiaryPhotoGalleryProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewPhoto, setViewPhoto] = useState<any>(null);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["diary_photos", entryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diary_photos")
        .select("*")
        .eq("diary_entry_id", entryId)
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!entryId && !!companyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (photo: any) => {
      // Delete from storage
      await supabase.storage.from("diary-photos").remove([photo.storage_path]);
      // Delete metadata
      const { error } = await supabase.from("diary_photos").delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary_photos", entryId] });
      setViewPhoto(null);
      toast({ title: "Foto removida!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from("diary-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const downloadPhoto = (photo: any) => {
    const url = getPublicUrl(photo.storage_path);
    const a = document.createElement("a");
    a.href = url;
    a.download = photo.file_name;
    a.target = "_blank";
    a.click();
  };

  const downloadAll = () => {
    photos.forEach((p) => downloadPhoto(p));
  };

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (photos.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {photos.length} foto(s)
          </span>
        </div>
        {!compact && photos.length > 1 && (
          <Button variant="ghost" size="sm" onClick={downloadAll} className="h-7 text-xs">
            <Download className="mr-1 h-3 w-3" /> Baixar todas
          </Button>
        )}
      </div>

      <div className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5"}`}>
        {photos.map((photo) => (
          <button
            key={photo.id}
            onClick={() => setViewPhoto(photo)}
            className="relative aspect-square rounded-md overflow-hidden border hover:ring-2 hover:ring-primary/50 transition-all group"
          >
            <img
              src={getPublicUrl(photo.storage_path)}
              alt={photo.description || photo.file_name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
              {photo.file_name && (
                <p className="text-[10px] text-white font-medium truncate">{photo.file_name}</p>
              )}
              {photo.captured_at && (
                <p className="text-[9px] text-white/80">{format(new Date(photo.captured_at), "dd/MM/yyyy", { locale: ptBR })}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      <Dialog open={!!viewPhoto} onOpenChange={(v) => !v && setViewPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {viewPhoto && (
            <div>
              <img
                src={getPublicUrl(viewPhoto.storage_path)}
                alt={viewPhoto.description || viewPhoto.file_name}
                className="w-full max-h-[70vh] object-contain bg-black"
              />
              <div className="p-4 space-y-2">
                {viewPhoto.description && (
                  <p className="text-sm font-medium">{viewPhoto.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {viewPhoto.activity && <Badge variant="secondary">{viewPhoto.activity}</Badge>}
                  {viewPhoto.captured_at && (
                    <span>{format(new Date(viewPhoto.captured_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  )}
                  {viewPhoto.latitude && viewPhoto.longitude && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      {viewPhoto.latitude.toFixed(4)}, {viewPhoto.longitude.toFixed(4)}
                    </span>
                  )}
                  <span>{viewPhoto.file_name}</span>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => downloadPhoto(viewPhoto)}>
                    <Download className="mr-1 h-3 w-3" /> Download
                  </Button>
                  {viewPhoto.uploaded_by === user?.id && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(viewPhoto)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
                      Excluir
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
