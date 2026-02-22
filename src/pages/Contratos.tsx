import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";

export default function Contratos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão Contratual</h1>
          <p className="text-muted-foreground">Contratos, obrigações, aditivos e medições.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Nenhum contrato cadastrado</p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            Adicione contratos para gerenciar obrigações e prazos.
          </p>
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Contrato
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
