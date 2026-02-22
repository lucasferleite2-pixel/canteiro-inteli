import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList } from "lucide-react";

export default function DiarioObra() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diário de Obra</h1>
          <p className="text-muted-foreground">Registros diários de atividades, equipe, clima e ocorrências.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Registro
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Nenhum registro de diário</p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            Selecione uma obra e adicione o primeiro registro diário.
          </p>
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Registro
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
