import { Link, useLocation } from "react-router";
import { useState } from "react";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import { trpc } from "@/providers/trpc";
import {
  LayoutDashboard,
  Package,
  Plus,
  LogOut,
  Menu,
  ChevronRight,
  Truck,
  Search,
  Globe,
} from "lucide-react";

const isGanga = (username: string | undefined) => username === "ganga_santa_rosa";

function cleanName(name: string | undefined): string {
  if (!name) return "";
  const upper = name.toUpperCase();
  if (upper.includes("GANGA")) return "Ganga Santa Rosa";
  return name.replace(/AMERICAN OUTLET\s*/i, "").trim() || name;
}

// Menu para tiendas normales (sin acceso a Rutas)
const storeNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/envios", label: "Mis Envios", icon: Package },
  { path: "/enviar", label: "Crear Envio", icon: Plus },
  { path: "/envios-nacionales", label: "Envios Nacionales", icon: Globe },
  { path: "/rastrear", label: "Rastrear", icon: Search },
];

// Menu para Bodega (acceso a todo incluyendo Rutas)
const warehouseNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/envios", label: "Mis Envios", icon: Package },
  { path: "/enviar", label: "Crear Envio", icon: Plus },
  { path: "/envios-nacionales", label: "Envios Nacionales", icon: Globe },
  { path: "/rutas", label: "Rutas", icon: Truck },
  { path: "/rastrear", label: "Rastrear", icon: Search },
];

// Menu para Chofer (solo Rutas)
const driverNavItems = [
  { path: "/rutas", label: "Mis Rutas", icon: Truck },
];

// Menu para Bodega de recepcion (ej: Sabana) — solo recibe, no crea envios
const receivingWarehouseNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/envios", label: "Mis Envios", icon: Package },
  { path: "/rastrear", label: "Rastrear", icon: Search },
];

export default function FranchiseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  const { user, logout, isLoading } = useFranchiseAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: pendingCount } = trpc.shipment.pendingCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const showBadge = pendingCount && pendingCount > 0;
  const ganga = isGanga(user?.username);
  const brandName = ganga ? "Ganga Santa Rosa" : "American Outlet";
  const logoUrl = ganga ? "/logo-ganga.jpg" : "/logo.jpg";

  return (
    <div className="flex h-screen bg-[#F7F7F7]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0A0A0A] text-white flex flex-col transform transition-transform duration-200 lg:transform-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt={brandName}
              className="w-10 h-10 rounded-xl object-contain bg-white shrink-0"
            />
            <div>
              <h1 className="font-bold text-sm leading-tight text-white">
                {brandName}
              </h1>
              <p className="text-[10px] text-white/50 uppercase tracking-wider">
                Sistema de Envios
              </p>
            </div>
          </Link>
        </div>

        {/* User Info */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#C8102E]/20 rounded-lg flex items-center justify-center">
              <Truck className="w-4 h-4 text-[#C8102E]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">
                {cleanName(user?.franchise?.displayName || user?.franchise?.name) || "Franquicia"}
              </p>
              <p className="text-[10px] text-white/50 truncate">
                {user?.displayName || "Usuario"}
              </p>
            </div>
            {showBadge && (
              <span className="shrink-0 w-5 h-5 bg-[#C8102E] rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                {pendingCount && pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {(user?.username === "chofer"
            ? driverNavItems
            : user?.username === "bodega_sabana"
            ? receivingWarehouseNavItems
            : user?.franchise?.isWarehouse
            ? warehouseNavItems
            : storeNavItems
          ).map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#C8102E] text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon
                  className={`w-4.5 h-4.5 shrink-0 ${
                    isActive ? "text-white" : "text-white/50"
                  }`}
                />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={logout}
            disabled={isLoading}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-red-400 transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-4.5 h-4.5" />
            {isLoading ? "Cerrando..." : "Cerrar Sesion"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-[#F0F0F0] px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-[#F7F7F7]"
          >
            <Menu className="w-5 h-5 text-[#1A1A1A]" />
          </button>
          <div className="flex items-center gap-2">
            <img
              src={logoUrl}
              alt={brandName}
              className="w-8 h-8 rounded-lg object-contain bg-[#C8102E]"
            />
            <span className="font-bold text-sm text-[#1A1A1A]">
              {brandName}
            </span>
          </div>
          {showBadge && (
            <span className="ml-auto w-5 h-5 bg-[#C8102E] rounded-full flex items-center justify-center text-[10px] font-bold text-white">
              {pendingCount && pendingCount > 9 ? "9+" : pendingCount}
            </span>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
