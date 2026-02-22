import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Obras from "@/pages/Obras";
import DiarioObra from "@/pages/DiarioObra";
import Contratos from "@/pages/Contratos";
import Financeiro from "@/pages/Financeiro";
import Licitacoes from "@/pages/Licitacoes";
import Alertas from "@/pages/Alertas";
import Usuarios from "@/pages/Usuarios";
import Auth from "@/pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/obras" element={<Obras />} />
            <Route path="/diario" element={<DiarioObra />} />
            <Route path="/contratos" element={<Contratos />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/licitacoes" element={<Licitacoes />} />
            <Route path="/alertas" element={<Alertas />} />
            <Route path="/usuarios" element={<Usuarios />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
