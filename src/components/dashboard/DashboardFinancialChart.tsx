import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface FinancialByProject {
  name: string;
  receita: number;
  despesa: number;
}

export function DashboardFinancialChart({ data }: { data: FinancialByProject[] }) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(v);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Receitas vs Despesas por Obra
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sem registros financeiros.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} barGap={2}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrency(v)}
                width={70}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, name: string) => [formatCurrency(v), name === "receita" ? "Receita" : "Despesa"]}
              />
              <Legend
                formatter={(value) => (value === "receita" ? "Receita" : "Despesa")}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="receita" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="despesa" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
