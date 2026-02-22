import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function CompanySetup() {
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !companyName.trim()) return;
    setSubmitting(true);

    try {
      // Create company
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({ name: companyName.trim(), cnpj: cnpj.trim() || null, owner_id: user.id })
        .select()
        .single();

      if (companyError) throw companyError;

      // Update profile with company_id
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ company_id: company.id })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // Assign admin role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: user.id, company_id: company.id, role: "admin" });

      if (roleError) throw roleError;

      toast({ title: "Empresa criada com sucesso!" });
      await refreshProfile();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    }
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold">Configurar Empresa</CardTitle>
          <p className="text-sm text-muted-foreground">
            Crie sua empresa para começar a usar o sistema.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company">Nome da Empresa</Label>
              <Input
                id="company"
                placeholder="Construtora Exemplo LTDA"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ (opcional)</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
              />
            </div>
            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Empresa
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
