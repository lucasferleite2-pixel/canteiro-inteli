import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Building2 } from "lucide-react";

export default function Obras() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Obras</h1>
          <p className="text-muted-foreground">Gerencie todas as suas obras em um só lugar.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Obra
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Nenhuma obra cadastrada</p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            Cadastre sua primeira obra para começar.
          </p>
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar Obra
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
