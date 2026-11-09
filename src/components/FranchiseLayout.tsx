import { Link, Navigate, Outlet, useLocation } from "react-router";
import { useState } from "react";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import { trpc } from "@/providers/trpc";
import {
  LayoutDashboard,
  Package,
  Plus,
  LogOut,
  Menu,
  Truck,
  Search,
  Globe,
  ShieldCheck,
  Settings,
} from "lucide-react";

export function RequireFranchise() {
  const { user, isLoading } = useFranchiseAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7]">
        <p className="text-sm text-[#8A8A8A]">Comprobando sesión...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const path = location.pathname;
  const isDriver = user.username === "chofer";
  const isReceivingOnly = user.username === "bodega_sabana";
  const franchiseCode = user.franchise?.code?.toLowerCase();
  const canUseRoutes = isDriver || user.username === "bodega_cedi" || franchiseCode === "bodega_cedi";
  const blockedForReceiving = path === "/enviar"
    || path.startsWith("/envios-nacionales")
    || path.startsWith("/rutas")
    || path.startsWith("/garantias")
    || path.startsWith("/boleta-garantia")
    || path.startsWith("/bitacora-garantia");

  if (isDriver && !path.startsWith("/rutas")) {
    return <Navigate to="/rutas" replace />;
  }

  if (isReceivingOnly && blockedForReceiving) {
    return <Navigate to="/dashboard" replace />;
  }

  if (path.startsWith("/rutas") && !canUseRoutes) {
    return <Navigate to="/dashboard" replace />;
  }

  const canManagePasswords = user.username === "bodega" || user.username === "bodega_cedi";
  if (path.startsWith("/configuracion") && !canManagePasswords) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

function cleanName(name: string | undefined): string {
  if (!name) return "";
  return name.replace(/AMERICAN OUTLET\s*/i, "").trim() || name;
}

// Menu para tiendas normales (sin acceso a Rutas)
const storeNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/envios", label: "Mis Envíos", icon: Package },
  { path: "/enviar", label: "Crear Envío", icon: Plus },
  { path: "/envios-nacionales", label: "Envíos Nacionales", icon: Globe },
  { path: "/garantias", label: "Garantías", icon: ShieldCheck },
  { path: "/rastrear", label: "Rastrear", icon: Search },
];

// Menu para Bodega Pavon (sin Rutas; esas las maneja chofer/Cedi)
const warehouseNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/envios", label: "Mis Envíos", icon: Package },
  { path: "/enviar", label: "Crear Envío", icon: Plus },
  { path: "/envios-nacionales", label: "Envíos Nacionales", icon: Globe },
  { path: "/garantias", label: "Garantías", icon: ShieldCheck },
  { path: "/rastrear", label: "Rastrear", icon: Search },
];

// Menu para Bodega Cedi (incluye Rutas del camion)
const cediNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/envios", label: "Mis Envíos", icon: Package },
  { path: "/enviar", label: "Crear Envío", icon: Plus },
  { path: "/rutas", label: "Rutas", icon: Truck },
  { path: "/envios-nacionales", label: "Envíos Nacionales", icon: Globe },
  { path: "/garantias", label: "Garantías", icon: ShieldCheck },
  { path: "/rastrear", label: "Rastrear", icon: Search },
];

// Menu para Chofer (solo Rutas)
const driverNavItems = [
  { path: "/rutas", label: "Mis Rutas", icon: Truck },
];

// Menu para Bodega de recepcion (ej: Sabana) — solo recibe, no crea envios
const receivingWarehouseNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/envios", label: "Mis Envíos", icon: Package },
  { path: "/rastrear", label: "Rastrear", icon: Search },
];

export default function FranchiseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  const { user, logout, isLoggingOut } = useFranchiseAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: pendingCount } = trpc.shipment.pendingCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000,
  });

  const showBadge = pendingCount && pendingCount > 0;
  const brandName = "American Outlet";
  const logoUrl = "/logo.jpg";

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
                Sistema de Envíos
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
                {cleanName(user?.displayName) || "Usuario"}
              </p>
            </div>
            {showBadge && (
              <span className="shrink-0 w-5 h-5 bg-[#C8102E] rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                {pendingCount && pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </div>
        </div>

          <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
            {(() => {
              const managesPasswords = user?.username === "bodega" || user?.username === "bodega_cedi";
              const settingsItem = { path: "/configuracion", label: "Configuraciones", icon: Settings };
              const withSettings = (items: typeof storeNavItems) => managesPasswords ? [...items, settingsItem] : items;
              const isCedi = user?.username === "bodega_cedi" || user?.franchise?.code === "bodega_cedi";
              const groups = user?.username === "chofer"
                ? [{ label: "", items: driverNavItems }]
                : user?.username === "bodega_sabana"
                ? [
                    { label: "Trabajo", items: receivingWarehouseNavItems.slice(0, 2) },
                    { label: "Consulta", items: receivingWarehouseNavItems.slice(2) },
                  ]
                : isCedi
                ? [
                    { label: "Trabajo", items: cediNavItems.slice(0, 4) },
                    { label: "Consulta", items: withSettings(cediNavItems.slice(4)) },
                  ]
                : user?.franchise?.isWarehouse
                ? [
                    { label: "Trabajo", items: warehouseNavItems.slice(0, 3) },
                    { label: "Consulta", items: withSettings(warehouseNavItems.slice(3)) },
                  ]
                : [
                    { label: "Trabajo", items: storeNavItems.slice(0, 3) },
                    { label: "Consulta", items: withSettings(storeNavItems.slice(3)) },
                  ];
              return groups;
            })().map((group) => (
              <div key={group.label || "solo"} className="space-y-1">
                {group.label && (
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className={`w-0.5 h-4 rounded-full ${isActive ? "bg-[#C8102E]" : "bg-transparent"}`} />
                      <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-white/45"}`} />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={logout}
            disabled={isLoggingOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-red-400 transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-4.5 h-4.5" />
            {isLoggingOut ? "Cerrando..." : "Cerrar Sesión"}
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
