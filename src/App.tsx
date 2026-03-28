import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Obras from "@/pages/Obras";
import DiarioObra from "@/pages/DiarioObra";
import Contratos from "@/pages/Contratos";
import Financeiro from "@/pages/Financeiro";
import Licitacoes from "@/pages/Licitacoes";
import Alertas from "@/pages/Alertas";
import Usuarios from "@/pages/Usuarios";
import EmpresaConfig from "@/pages/EmpresaConfig";
import AuditoriaRdo from "@/pages/AuditoriaRdo";
import Comparativo from "@/pages/Comparativo";
import PlanejamentoFases from "@/pages/PlanejamentoFases";
import ExportarDados from "@/pages/ExportarDados";
import Auth from "@/pages/Auth";
import CompanySetup from "@/pages/CompanySetup";
import NotFound from "./pages/NotFound";
import VerificarDocumento from "@/pages/VerificarDocumento";

const queryClient = new QueryClient();

function ProtectedAppLayout() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}

function ProtectedCompanySetup() {
  return (
    <ProtectedRoute>
      <CompanySetup />
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/empresa" element={<ProtectedCompanySetup />} />
            <Route element={<ProtectedAppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/obras" element={<Obras />} />
              <Route path="/diario" element={<DiarioObra />} />
              <Route path="/contratos" element={<Contratos />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/licitacoes" element={<Licitacoes />} />
              <Route path="/alertas" element={<Alertas />} />
              <Route path="/usuarios" element={<Usuarios />} />
              <Route path="/empresa/config" element={<EmpresaConfig />} />
              <Route path="/auditoria" element={<AuditoriaRdo />} />
              <Route path="/comparativo" element={<Comparativo />} />
              <Route path="/planejamento" element={<PlanejamentoFases />} />
            </Route>
            <Route path="/verificar/:documentId" element={<VerificarDocumento />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
