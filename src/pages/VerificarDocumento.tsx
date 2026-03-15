import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, ShieldAlert, Loader2, FileText, Building2, User, Hash, Calendar, Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface VerificationRecord {
  report_id: string;
  report_type: string;
  project_name: string;
  company_name: string | null;
  generated_at: string;
  generated_by: string | null;
  integrity_hash: string;
  short_hash: string;
  entries_count: number | null;
  technical_responsible: string | null;
  metadata: any;
}

const reportTypeLabels: Record<string, string> = {
  rdo: "Relatório Diário de Obra (RDO)",
  diary: "Diário de Obra",
  nc: "Laudo de Não Conformidade",
  planejamento: "Relatório de Planejamento",
};

export default function VerificarDocumento() {
  const { documentId } = useParams<{ documentId: string }>();
  const [record, setRecord] = useState<VerificationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!documentId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("report_verifications")
        .select("report_id, report_type, project_name, company_name, generated_at, generated_by, integrity_hash, short_hash, entries_count, technical_responsible, metadata")
        .eq("report_id", documentId)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setRecord(data as any);
      }
      setLoading(false);
    })();
  }, [documentId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Verificando documento...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-red-50 p-4">
        <Card className="max-w-lg w-full shadow-xl border-red-200">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-red-700">Documento Não Encontrado</h1>
            <p className="text-sm text-muted-foreground">
              O identificador <code className="bg-red-50 px-2 py-0.5 rounded text-red-600 text-xs">{documentId}</code> não corresponde a nenhum relatório registrado no sistema.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Se você acredita que isto é um erro, entre em contato com a empresa emissora do documento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const r = record!;
  const generatedDate = new Date(r.generated_at).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="max-w-lg w-full shadow-xl border-green-200">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-5">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <Shield className="h-8 w-8 text-green-600" />
          </div>

          <div className="text-center">
            <Badge variant="outline" className="border-green-500 text-green-700 mb-2">
              ✓ Documento Autêntico
            </Badge>
            <h1 className="text-lg font-bold text-foreground mt-1">
              {reportTypeLabels[r.report_type] || r.report_type}
            </h1>
          </div>

          <Separator />

          <div className="w-full space-y-3 text-sm">
            <InfoRow icon={<FileText className="h-4 w-4" />} label="ID do Documento" value={r.report_id} mono />
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="Obra" value={r.project_name} />
            {r.company_name && (
              <InfoRow icon={<Building2 className="h-4 w-4" />} label="Empresa Emissora" value={r.company_name} />
            )}
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Data de Geração" value={generatedDate} />
            {r.generated_by && (
              <InfoRow icon={<User className="h-4 w-4" />} label="Gerado por" value={r.generated_by} />
            )}
            {r.technical_responsible && (
              <InfoRow icon={<User className="h-4 w-4" />} label="Responsável Técnico" value={r.technical_responsible} />
            )}
            {r.entries_count != null && r.entries_count > 0 && (
              <InfoRow icon={<Database className="h-4 w-4" />} label="Registros" value={`${r.entries_count} registro(s)`} />
            )}
            <InfoRow icon={<Hash className="h-4 w-4" />} label="Hash SHA-256" value={r.integrity_hash} mono small />
          </div>

          <Separator />

          <p className="text-xs text-muted-foreground text-center">
            Este documento foi verificado com sucesso no sistema Canteiro Inteli.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ icon, label, value, mono, small }: { icon: React.ReactNode; label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`font-medium break-all ${mono ? "font-mono" : ""} ${small ? "text-xs" : "text-sm"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
