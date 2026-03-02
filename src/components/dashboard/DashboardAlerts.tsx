import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, ShieldAlert, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AlertItem {
  id: string;
  title: string;
  message: string | null;
  severity: string;
  created_at: string;
  project_name?: string;
}

const severityConfig: Record<string, { icon: typeof AlertTriangle; color: string; bg: string; label: string }> = {
  critical: { icon: ShieldAlert, color: "text-destructive", bg: "bg-destructive/10", label: "Crítico" },
  high: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", label: "Alto" },
  warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", label: "Atenção" },
  info: { icon: Info, color: "text-info", bg: "bg-info/10", label: "Info" },
};

export function DashboardAlerts({ alerts }: { alerts: AlertItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-warning" />
            Alertas Pendentes
          </CardTitle>
          {alerts.length > 0 && (
            <Badge variant="destructive" className="text-xs">{alerts.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-muted-foreground">
            <Bell className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhum alerta pendente.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {alerts.map((alert) => {
              const sev = severityConfig[alert.severity] || severityConfig.info;
              const Icon = sev.icon;
              return (
                <div key={alert.id} className="flex items-start gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <div className={`rounded-md p-1.5 mt-0.5 shrink-0 ${sev.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${sev.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{alert.title}</p>
                    </div>
                    {alert.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.message}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {alert.project_name && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{alert.project_name}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
