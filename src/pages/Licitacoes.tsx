import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Gavel } from "lucide-react";

export default function Licitacoes() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Licitações</h1>
          <p className="text-muted-foreground">Pipeline completo de licitação à execução.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Licitação
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Gavel className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Nenhuma licitação cadastrada</p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            Cadastre editais e acompanhe todo o processo licitatório.
          </p>
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar Licitação
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
