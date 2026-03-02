import { Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";

export function DemoBanner() {
  const { isDemo } = useAuth();
  if (!isDemo) return null;

  return (
    <Alert className="border-warning/30 bg-warning/10">
      <Eye className="h-4 w-4 text-warning" />
      <AlertDescription className="text-sm text-warning font-medium">
        Você está no <strong>modo demonstração</strong> — os dados exibidos são fictícios e servem apenas para apresentação.
      </AlertDescription>
    </Alert>
  );
}
