import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  rdoDiaId: string;
  companyId: string;
  canEdit: boolean;
}

export function RdoFotoTab({ rdoDiaId, companyId, canEdit }: Props) {
  const { data: fotos = [], isLoading } = useQuery({
    queryKey: ["rdo_foto", rdoDiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rdo_foto")
        .select("*")
        .eq("rdo_dia_id", rdoDiaId)
        .order("created_at");
      if (error) throw error;
      // Get public URLs
      return data.map((f: any) => {
        const { data: urlData } = supabase.storage.from("diary-photos").getPublicUrl(f.storage_path);
        return { ...f, url: urlData.publicUrl };
      });
    },
  });

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (fotos.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma foto neste registro.</p>
        <p className="text-xs mt-1">As fotos do sistema legado estão disponíveis na visualização antiga.</p>
      </div>
    );
  }

  const tagColors: Record<string, string> = {
    nenhuma: "",
    "técnico": "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    "segurança": "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    contratual: "bg-red-500/10 text-red-700 dark:text-red-400",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {fotos.map((f: any) => (
        <div key={f.id} className="relative group rounded-md overflow-hidden border">
          <img
            src={f.url}
            alt={f.descricao || f.file_name}
            className="w-full aspect-square object-cover"
            loading="lazy"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            {f.descricao && <p className="text-[10px] text-white line-clamp-2">{f.descricao}</p>}
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
  );
}
