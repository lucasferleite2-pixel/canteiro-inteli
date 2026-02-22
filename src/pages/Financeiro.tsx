import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";

const financialStats = [
  { label: "Orçamento Total", value: "R$ 0,00", icon: Wallet, color: "text-primary" },
  { label: "Realizado", value: "R$ 0,00", icon: TrendingUp, color: "text-success" },
  { label: "A Pagar", value: "R$ 0,00", icon: TrendingDown, color: "text-destructive" },
  { label: "Saldo", value: "R$ 0,00", icon: DollarSign, color: "text-info" },
];

export default function Financeiro() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-muted-foreground">Controle financeiro integrado por obra.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {financialStats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Orçado vs Realizado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Cadastre obras com orçamento para visualizar o comparativo.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fluxo de Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Dados disponíveis após lançamentos financeiros.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
