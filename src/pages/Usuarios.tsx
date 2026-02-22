import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";

export default function Usuarios() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários e Permissões</h1>
          <p className="text-muted-foreground">Gerencie membros da empresa e controle de acesso.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Convidar Membro
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Nenhum membro cadastrado</p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            Convide membros da sua equipe para colaborar no sistema.
          </p>
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Convidar Membro
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
