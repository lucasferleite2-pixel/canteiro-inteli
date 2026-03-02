import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  DollarSign,
  Gavel,
  Bell,
  Users,
  Building2,
  HardHat,
  Settings,
  Shield,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Obras", url: "/obras", icon: Building2 },
  { title: "Diário de Obra", url: "/diario", icon: ClipboardList },
];

const controlItems = [
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Licitações", url: "/licitacoes", icon: Gavel },
];

const systemItems = [
  { title: "Alertas", url: "/alertas", icon: Bell },
  { title: "Auditoria RDO", url: "/auditoria", icon: Shield },
  { title: "Usuários", url: "/usuarios", icon: Users },
  { title: "Empresa", url: "/empresa/config", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { profile } = useAuth();

  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  const renderGroup = (
    label: string,
    items: { title: string; url: string; icon: React.ElementType }[]
  ) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <NavLink
                  to={item.url}
                  end={item.url === "/"}
                  className="hover:bg-sidebar-accent/50"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <HardHat className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground">
              ERP Obra Inteligente
            </h1>
            <p className="text-[10px] text-muted-foreground">
              Gestão de Obras
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Principal", mainItems)}
        {renderGroup("Controle", controlItems)}
        {renderGroup("Sistema", systemItems)}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="text-center">
          <p className="text-xs font-medium text-sidebar-foreground truncate">
            {profile?.full_name || "Usuário"}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {profile?.email || ""}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
