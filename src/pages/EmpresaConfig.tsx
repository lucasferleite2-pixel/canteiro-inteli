import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Loader2, Upload, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function EmpresaConfig() {
  const { companyId, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [technicalResponsible, setTechnicalResponsible] = useState("");
  const [brandColor, setBrandColor] = useState("#1E40AF");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();
      if (data) {
        setName(data.name || "");
        setCnpj(data.cnpj || "");
        setAddress(data.address || "");
        setPhone(data.phone || "");
        setTechnicalResponsible(data.technical_responsible || "");
        setBrandColor(data.brand_color || "#1E40AF");
        setLogoUrl(data.logo_url || null);
      }
      setLoading(false);
    })();
  }, [companyId]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast({ variant: "destructive", title: "Formato inválido", description: "Use PNG, JPG, WebP ou SVG." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Arquivo muito grande", description: "Máximo 2MB." });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${companyId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("company-logos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ variant: "destructive", title: "Erro no upload", description: uploadError.message });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("company-logos").getPublicUrl(path);
    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    setLogoUrl(newUrl);

    await supabase.from("companies").update({ logo_url: newUrl }).eq("id", companyId);
    toast({ title: "Logo atualizado!" });
    setUploading(false);
  };

  const handleRemoveLogo = async () => {
    if (!companyId) return;
    setUploading(true);
    await supabase.from("companies").update({ logo_url: null }).eq("id", companyId);
    setLogoUrl(null);
    toast({ title: "Logo removido." });
    setUploading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !name.trim()) return;
    setSaving(true);

    const { error } = await supabase
      .from("companies")
      .update({
        name: name.trim(),
        cnpj: cnpj.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        technical_responsible: technicalResponsible.trim() || null,
        brand_color: brandColor,
      })
      .eq("id", companyId);

    if (error) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
    } else {
      toast({ title: "Dados da empresa atualizados!" });
      await refreshProfile();
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Você precisa estar vinculado a uma empresa para acessar esta página.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuração da Empresa</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie os dados corporativos que aparecem em relatórios e documentos.
        </p>
      </div>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Logotipo</CardTitle>
          <CardDescription>Usado na capa de relatórios e documentos oficiais.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start gap-4">
          <div className="h-24 w-24 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <Building2 className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="logo-upload" className="cursor-pointer">
              <div className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                <Upload className="h-4 w-4" />
                {uploading ? "Enviando..." : "Enviar logo"}
              </div>
              <input
                id="logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoUpload}
                disabled={uploading}
              />
            </Label>
            {logoUrl && (
              <Button variant="ghost" size="sm" onClick={handleRemoveLogo} disabled={uploading} className="justify-start text-destructive hover:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Remover logo
              </Button>
            )}
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP ou SVG. Máx 2MB.</p>
          </div>
        </CardContent>
      </Card>

      {/* Dados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados Corporativos</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" maxLength={18} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} maxLength={500} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" maxLength={20} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tech">Responsável Técnico (CREA/CAU)</Label>
                <Input id="tech" value={technicalResponsible} onChange={(e) => setTechnicalResponsible(e.target.value)} placeholder="Eng. João – CREA 12345" maxLength={200} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand-color">Cor Primária da Marca</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="brand-color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-input bg-background p-1"
                />
                <Input
                  value={brandColor}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setBrandColor(v);
                  }}
                  className="w-28 font-mono"
                  maxLength={7}
                />
                <div className="h-10 flex-1 rounded-md" style={{ backgroundColor: brandColor }} />
              </div>
              <p className="text-xs text-muted-foreground">Aplicada em relatórios PDF e documentos exportados.</p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
