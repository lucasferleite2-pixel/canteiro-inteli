import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, AlertTriangle, Clock, Shield } from "lucide-react";

export default function Alertas() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alertas Estratégicos</h1>
        <p className="text-muted-foreground">Notificações automáticas e indicadores de risco.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Críticos</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">0</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Atenção</CardTitle>
            <Clock className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">0</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Informativos</CardTitle>
            <Bell className="h-5 w-5 text-info" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">0</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolvidos</CardTitle>
            <Shield className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">0</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Central de Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhum alerta no momento. Alertas serão gerados automaticamente conforme a operação do sistema.</p>
        </CardContent>
      </Card>
    </div>
  );
}
