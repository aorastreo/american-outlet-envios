import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Truck, Plus, MapPin, Package, ChevronRight, AlertCircle, Play, CheckCircle,
  XCircle, ClipboardList, ArrowUp, ArrowDown, Trash2, User, Phone,
  MessageCircle, Send, Barcode, FileText, Store, ArrowRight, ClipboardCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function getStatusConfig(status: string) {
  const configs: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    CREADO: { color: "bg-slate-100 text-[#1A1A1A]", label: "Creado", icon: Package },
    RECIBIDO_EN_BODEGA: { color: "bg-purple-50 text-purple-700", label: "En Bodega", icon: ClipboardCheck },
    EN_RUTA: { color: "bg-blue-50 text-blue-700", label: "En Ruta", icon: Truck },
    EN_PARADA: { color: "bg-orange-50 text-orange-700", label: "En Parada", icon: MapPin },
    RECIBIDO_EN_DESTINO: { color: "bg-emerald-50 text-[#1B6B3E]", label: "Entregado", icon: CheckCircle },
    NO_RECOGIDO: { color: "bg-red-50 text-red-700", label: "No Recogido", icon: XCircle },
    CANCELADO: { color: "bg-red-50 text-red-700", label: "Cancelado", icon: XCircle },
    PLANIFICADA: { color: "bg-blue-50 text-blue-700", label: "Planificada", icon: AlertCircle },
    COMPLETADA: { color: "bg-emerald-50 text-[#1B6B3E]", label: "Completada", icon: CheckCircle },
  };
  return configs[status] || { color: "bg-gray-100 text-gray-500", label: status, icon: Package };
}

function cleanName(name: string | undefined): string {
  if (!name) return "";
  const upper = name.toUpperCase();
  if (upper.includes("GANGA")) return "Ganga Santa Rosa";
  return name.replace(/AMERICAN OUTLET\s*/i, "").trim() || name;
}

// Defensive: verify destination is actually a route pickup point
function isRouteDestination(shipment: any): boolean {
  const destName = (shipment.destinationFranchise?.displayName || "").toLowerCase();
  const destCode = (shipment.destinationFranchise?.code || "").toLowerCase();
  return (
    destName.includes("recogida") ||
    ["grecia", "palmares", "san ramon"].some((city) => destName.includes(city)) ||
    ["grecia", "palmares", "san_ramon"].includes(destCode)
  );
}

type RouteTab = "EN_BODEGA" | "EN_RUTA" | "NO_RECOGIDOS" | "ENTREGADOS";

const TABS: { key: RouteTab; label: string; icon: React.ElementType; statuses: string[]; color: string; activeColor: string; activeBg: string; activeBorder: string; badgeColor: string }[] = [
  {
    key: "EN_BODEGA",
    label: "En Bodega",
    icon: ClipboardCheck,
    statuses: ["RECIBIDO_EN_BODEGA"],
    color: "text-[#525252]",
    activeColor: "text-purple-700",
    activeBg: "bg-purple-50",
    activeBorder: "border-purple-700",
    badgeColor: "bg-purple-700 text-white",
  },
  {
    key: "EN_RUTA",
    label: "En Ruta",
    icon: Truck,
    statuses: ["EN_RUTA", "EN_PARADA"],
    color: "text-[#525252]",
    activeColor: "text-blue-700",
    activeBg: "bg-blue-50",
    activeBorder: "border-blue-700",
    badgeColor: "bg-blue-700 text-white",
  },
  {
    key: "NO_RECOGIDOS",
    label: "No Recogidos",
    icon: XCircle,
    statuses: ["NO_RECOGIDO"],
    color: "text-[#525252]",
    activeColor: "text-red-700",
    activeBg: "bg-red-50",
    activeBorder: "border-red-700",
    badgeColor: "bg-red-700 text-white",
  },
  {
    key: "ENTREGADOS",
    label: "Entregados",
    icon: CheckCircle,
    statuses: ["RECIBIDO_EN_DESTINO"],
    color: "text-[#525252]",
    activeColor: "text-[#1B6B3E]",
    activeBg: "bg-emerald-50",
    activeBorder: "border-[#1B6B3E]",
    badgeColor: "bg-[#1B6B3E] text-white",
  },
];

export default function Rutas() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useFranchiseAuth();

  useEffect(() => {
    if (!authLoading && user) {
      const isWarehouse = user?.franchise?.isWarehouse === 1;
      const isDriver = user?.username === "chofer";
      if (!isWarehouse && !isDriver) {
        navigate("/dashboard");
      }
    }
  }, [user, authLoading, navigate]);

  const [activeTab, setActiveTab] = useState<RouteTab>("EN_BODEGA");
  const [createDialog, setCreateDialog] = useState(false);
  const [pendingDialog, setPendingDialog] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [routeDate, setRouteDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cities, setCities] = useState<string[]>([]);
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<number[]>([]);
  const utils = trpc.useUtils();

  // All route shipments (new endpoint)
  const { data: routeShipments, isLoading: shipmentsLoading } = trpc.route.getRouteShipments.useQuery();
  const { data: routes, isLoading: routesLoading } = trpc.route.list.useQuery();
  const { data: pendingByCity } = trpc.route.pendingByPickupPoint.useQuery(undefined, {
    enabled: pendingDialog || createDialog,
  });

  // Filter shipments by active tab — defensive: only route shipments + correct status
  const filteredShipments = useMemo(() => {
    if (!routeShipments) return [];
    const routeOnly = routeShipments.filter(isRouteDestination);
    if (activeTab === "EN_BODEGA") {
      return routeOnly.filter(
        (s) =>
          s.status === "RECIBIDO_EN_BODEGA" ||
          (s.status === "CREADO" && s.originFranchise?.isWarehouse === 1)
      );
    }
    if (activeTab === "EN_RUTA") {
      return routeOnly.filter((s) => s.status === "EN_RUTA" || s.status === "EN_PARADA");
    }
    if (activeTab === "NO_RECOGIDOS") {
      return routeOnly.filter((s) => s.status === "NO_RECOGIDO");
    }
    // ENTREGADOS
    return routeOnly.filter((s) => s.status === "RECIBIDO_EN_DESTINO");
  }, [routeShipments, activeTab]);

  // Count per tab
  const tabCounts = useMemo(() => {
    if (!routeShipments) return { EN_BODEGA: 0, EN_RUTA: 0, NO_RECOGIDOS: 0, ENTREGADOS: 0 };
    const routeOnly = routeShipments.filter(isRouteDestination);
    return {
      EN_BODEGA:
        routeOnly.filter(
          (s) =>
            s.status === "RECIBIDO_EN_BODEGA" ||
            (s.status === "CREADO" && s.originFranchise?.isWarehouse === 1)
        ).length,
      EN_RUTA: routeOnly.filter((s) => s.status === "EN_RUTA" || s.status === "EN_PARADA").length,
      NO_RECOGIDOS: routeOnly.filter((s) => s.status === "NO_RECOGIDO").length,
      ENTREGADOS: routeOnly.filter((s) => s.status === "RECIBIDO_EN_DESTINO").length,
    };
  }, [routeShipments]);

  // Current tab
  const currentTab = TABS.find(t => t.key === activeTab) ?? TABS[0];

  const totalPending = pendingByCity?.reduce((sum, group) => sum + group.count, 0) || 0;

  // ─── Route creation helpers ────────────────────────────────────
  useEffect(() => {
    if (createDialog && routeDate) {
      const formatted = format(new Date(routeDate + "T12:00:00"), "dd/MM/yyyy", { locale: es });
      setRouteName(`Ruta ${formatted}`);
    }
  }, [routeDate, createDialog]);

  const availableCities = pendingByCity
    ?.map(g => g.cityName)
    .filter((c, i, arr) => arr.indexOf(c) === i) || [];

  const preferredOrder = ["San Ramon", "Palmares", "Grecia"];
  const unaddedCities = availableCities
    .filter(c => !cities.includes(c))
    .sort((a, b) => {
      const idxA = preferredOrder.indexOf(a);
      const idxB = preferredOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

  const createMutation = trpc.route.create.useMutation({
    onSuccess: () => {
      utils.route.list.invalidate();
      setCreateDialog(false);
      setRouteName("");
      setRouteDate(format(new Date(), "yyyy-MM-dd"));
      setCities([]);
      toast.success("Ruta creada exitosamente");
    },
    onError: (err) => toast.error(err.message),
  });

  const addCity = (cityName: string) => {
    if (!cities.includes(cityName)) setCities([...cities, cityName]);
  };
  const moveCityUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...cities]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; setCities(next);
  };
  const moveCityDown = (idx: number) => {
    if (idx === cities.length - 1) return;
    const next = [...cities]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; setCities(next);
  };
  const removeCity = (idx: number) => setCities(cities.filter((_, i) => i !== idx));

  const handleCreate = () => {
    const validCities = cities.filter(Boolean);
    if (!routeName.trim() || validCities.length === 0) {
      toast.error("Seleccione al menos una ciudad");
      return;
    }
    createMutation.mutate({ name: routeName.trim(), stops: validCities.map(c => ({ cityName: c })) });
  };

  const toggleShipment = (shipmentId: number) => {
    setSelectedShipmentIds(prev =>
      prev.includes(shipmentId) ? prev.filter(id => id !== shipmentId) : [...prev, shipmentId]
    );
  };

  const addCityFromPending = (cityName: string) => {
    const cleanCity = cityName.replace("Recogida - ", "").trim();
    if (!cities.filter(Boolean).some(c => c.toLowerCase() === cleanCity.toLowerCase())) {
      setCities([...cities.filter(Boolean), cleanCity]);
    }
    setPendingDialog(false);
    setCreateDialog(true);
  };

  // ─── Render shipment card (like Shipments.tsx) ────────────────
  const renderShipmentCard = (shipment: any) => {
    const cfg = getStatusConfig(shipment.status);
    return (
      <Link to={`/envios/${shipment.id}`} key={shipment.id} className="block">
        <Card className="hover:shadow-md transition-shadow cursor-pointer border-[#F0F0F0] hover:border-[#C8102E]/20">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <Barcode className="w-4 h-4 text-[#C8102E]" />
                  <p className="font-semibold font-mono text-[#C8102E] text-lg">{shipment.trackingNumber}</p>
                  <Badge variant="secondary" className={cfg.color}>
                    <cfg.icon className="w-3 h-3 mr-1" />
                    {cfg.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm text-[#8A8A8A]">
                  <User className="w-3.5 h-3.5" />
                  <span>{shipment.senderName}</span>
                  {shipment.invoiceNumber && (
                    <span className="inline-block bg-[#C8102E] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded tracking-wide ml-1">
                      FACT: {shipment.invoiceNumber}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-[#8A8A8A]">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFF5F5] text-[#C8102E] rounded text-xs font-medium">
                    <Store className="w-3 h-3" />
                    {cleanName(shipment.originFranchise?.displayName) || "-"}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#D4D4D4]" />
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs font-bold border border-orange-200">
                    <MapPin className="w-3 h-3" />
                    {cleanName(shipment.destinationFranchise?.displayName) || "-"}
                  </span>
                </div>
                <p className="text-xs text-[#A3A3A3] mt-1">
                  {shipment.items?.length || 0} articulo{shipment.items?.length !== 1 ? "s" : ""}
                  {shipment.items?.map((i: any) => ` - ${i.description} x${i.quantity}`).join(", ")}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-[#A3A3A3]">
                  {shipment.createdAt ? format(new Date(shipment.createdAt), "dd/MM/yyyy", { locale: es }) : "-"}
                </p>
                <ChevronRight className="w-5 h-5 text-[#D4D4D4] ml-auto mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  const isLoading = shipmentsLoading || routesLoading;

  return (
    <FranchiseLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Envios de Ruta</h1>
            <p className="text-sm text-[#404040] mt-1">
              {filteredShipments.length} envio{filteredShipments.length !== 1 ? "s" : ""} - {currentTab.label}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setPendingDialog(true)} variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50">
              <ClipboardList className="w-4 h-4 mr-2" />
              Pendientes
              {totalPending > 0 && (
                <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-700">{totalPending}</Badge>
              )}
            </Button>
            <Button onClick={() => setCreateDialog(true)} className="bg-[#C8102E] hover:bg-[#9B0B22]">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Ruta
            </Button>
          </div>
        </div>

        {/* Pending alert */}
        {totalPending > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-800">
                    Hay {totalPending} envio{totalPending !== 1 ? "s" : ""} en bodega esperando ruta
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {pendingByCity?.map((group) => (
                      <Badge key={group.pickupId} variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                        <MapPin className="w-3 h-3 mr-1" />
                        {group.cityName}: {group.count}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Tabs ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const count = tabCounts[tab.key] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                  isActive
                    ? `${tab.activeBg} ${tab.activeBorder} shadow-sm`
                    : "bg-white border-[#E5E5E5] hover:bg-[#FAFAFA] hover:border-[#D4D4D4]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${isActive ? tab.activeColor : tab.color}`} />
                  <span className={`text-sm font-semibold ${isActive ? tab.activeColor : tab.color}`}>{tab.label}</span>
                </div>
                <Badge className={`text-xs font-bold ${isActive ? tab.badgeColor : "bg-[#F0F0F0] text-[#8A8A8A]"}`}>
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* ─── Routes list (only for EN_RUTA tab, shows active routes) ── */}
        {activeTab === "EN_RUTA" && routes && routes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wider">Rutas Activas</p>
            {routes.filter(r => r.status === "EN_RUTA" || r.status === "PLANIFICADA").map((route) => {
              const rcfg = getStatusConfig(route.status);
              return (
                <Link to={`/rutas/${route.id}`} key={route.id}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer border-[#F0F0F0] hover:border-[#C8102E]/20">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#FFF5F5] rounded-lg flex items-center justify-center">
                        <Truck className="w-4 h-4 text-[#C8102E]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#1A1A1A]">{route.name}</span>
                          <Badge variant="secondary" className={rcfg.color}>
                            <rcfg.icon className="w-3 h-3 mr-1" />{rcfg.label}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#D4D4D4]" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* ─── Shipment List ────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8102E]" />
          </div>
        ) : filteredShipments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <MapPin className="w-12 h-12 text-[#D4D4D4] mx-auto mb-3" />
              <p className="text-[#404040]">No hay envios {currentTab.label.toLowerCase()}</p>
              <p className="text-xs text-[#8A8A8A] mt-1">
                {activeTab === "EN_BODEGA"
                  ? "Los envios a Grecia, Palmares o San Ramon apareceran aqui cuando esten en bodega"
                  : activeTab === "EN_RUTA"
                  ? "Los envios apareceran aqui cuando el camion salga"
                  : "Los envios entregados apareceran aqui"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredShipments.map(renderShipmentCard)}
          </div>
        )}
      </div>

      {/* ============ DIALOGS (keep existing) ============ */}

      {/* Create Route Dialog */}
      <Dialog open={createDialog} onOpenChange={(open) => { setCreateDialog(open); if (!open) { setRouteName(""); setRouteDate(format(new Date(), "yyyy-MM-dd")); setCities([]); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#C8102E]" />
              Nueva Ruta de Camion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#1A1A1A] block mb-1">Fecha de la ruta</label>
              <input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)}
                className="w-full h-11 px-3 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E] text-[#1A1A1A]" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1A1A1A] block mb-1">Nombre de la ruta</label>
              <Input value={routeName} onChange={(e) => setRouteName(e.target.value)} className="focus:ring-[#C8102E] focus:border-[#C8102E]" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1A1A1A] block mb-2">Ciudades disponibles</label>
              {unaddedCities.length === 0 ? (
                <p className="text-xs text-[#8A8A8A] py-2">Todas las ciudades han sido agregadas</p>
              ) : (
                <div className="grid grid-cols-1 gap-1">
                  {unaddedCities.map((city) => (
                    <div key={city} className="flex items-center justify-between p-2 rounded-lg border border-[#F0F0F0] bg-white hover:bg-[#F7F7F7] transition-colors">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#C8102E]" />
                        <span className="text-sm font-medium text-[#1A1A1A]">{city}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => addCity(city)} className="h-7 px-2 text-[#C8102E] border-[#C8102E]/20 hover:bg-[#FFF5F5]">
                        <Plus className="w-3.5 h-3.5 mr-1" />Agregar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cities.length > 0 && (
              <div>
                <label className="text-sm font-medium text-[#1A1A1A] block mb-2">Paradas del recorrido</label>
                <div className="space-y-1.5">
                  {cities.map((city, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg border border-[#F0F0F0] bg-white">
                      <div className="w-7 h-7 bg-[#C8102E] rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">{idx + 1}</div>
                      <div className="flex items-center gap-2 flex-1">
                        <MapPin className="w-4 h-4 text-[#C8102E]" />
                        <span className="text-sm font-medium text-[#1A1A1A]">{city}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveCityUp(idx)} disabled={idx === 0} className="p-0.5 rounded hover:bg-[#F7F7F7] disabled:opacity-30 disabled:cursor-not-allowed text-[#525252]"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => moveCityDown(idx)} disabled={idx === cities.length - 1} className="p-0.5 rounded hover:bg-[#F7F7F7] disabled:opacity-30 disabled:cursor-not-allowed text-[#525252]"><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <button onClick={() => removeCity(idx)} className="p-1.5 rounded hover:bg-red-50 text-[#A3A3A3] hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {cities.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-[#8A8A8A] bg-[#F7F7F7] p-2 rounded-lg">
                <Truck className="w-3.5 h-3.5" />Recorrido: {cities.join(" -> ")}
              </div>
            )}
            <Button onClick={handleCreate} className="w-full bg-[#C8102E] hover:bg-[#9B0B22]" disabled={createMutation.isPending || cities.length === 0}>
              {createMutation.isPending ? "Creando..." : `Crear Ruta${cities.length > 0 ? ` (${cities.length} parada${cities.length !== 1 ? "s" : ""})` : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Shipments Dialog */}
      <Dialog open={pendingDialog} onOpenChange={setPendingDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-orange-600" />
              Envios Pendientes por Punto de Recogida
            </DialogTitle>
          </DialogHeader>
          {!pendingByCity || pendingByCity.length === 0 ? (
            <div className="text-center py-8 text-[#404040]">
              <Package className="w-10 h-10 text-[#D4D4D4] mx-auto mb-2" />
              <p>No hay envios pendientes para puntos de recogida</p>
              <p className="text-xs mt-1 text-[#8A8A8A]">Los envios deben estar en bodega con destino a Grecia, San Ramon o Palmares</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pendingByCity.map((group) => (
                <div key={group.pickupId} className="border border-orange-200 rounded-lg p-4 bg-orange-50/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-orange-600" />
                      <h3 className="font-bold text-orange-800">{group.cityName}</h3>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700">{group.count} envio{group.count !== 1 ? "s" : ""}</Badge>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addCityFromPending(group.fullDisplayName)} className="text-[#C8102E] border-[#C8102E]">
                      <Plus className="w-3 h-3 mr-1" />Agregar a Ruta
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {group.shipments.map((s: any) => (
                      <div key={s.id} className="p-4 rounded-lg bg-white border border-[#F0F0F0] hover:border-[#C8102E]/30 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3 mb-3">
                          <Checkbox checked={selectedShipmentIds.includes(s.id)} onCheckedChange={() => toggleShipment(s.id)} className="border-[#D4D4D4] data-[state=checked]:bg-[#C8102E] data-[state=checked]:border-[#C8102E]" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-mono font-bold text-[#C8102E]">{s.trackingNumber}</span>
                              {s.invoiceNumber && (
                                <span className="inline-block bg-[#C8102E] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded tracking-wide">FACT: {s.invoiceNumber}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-[#8A8A8A] bg-[#F7F7F7] px-2 py-1 rounded shrink-0">{s.originFranchise?.name || "-"}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-[#C8102E]" />
                            <div>
                              <p className="text-[10px] text-[#8A8A8A] uppercase">Remitente</p>
                              <p className="text-sm font-semibold text-[#1A1A1A]">{s.senderName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-[#C8102E]" />
                            <div className="flex-1">
                              <p className="text-[10px] text-[#8A8A8A] uppercase">Telefono</p>
                              <p className="text-sm font-medium text-[#1A1A1A]">{s.senderPhone}</p>
                            </div>
                            {s.senderPhone && (
                              <a href={`https://wa.me/506${s.senderPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366] hover:text-white px-2 py-1 rounded transition-colors shrink-0"
                                onClick={(e) => e.stopPropagation()}>
                                <MessageCircle className="w-3 h-3" />WhatsApp
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="bg-[#F7F7F7] rounded-lg p-3">
                          <p className="text-[10px] text-[#8A8A8A] uppercase font-semibold mb-2">Articulos del Envio ({s.items?.length || 0})</p>
                          <div className="space-y-1.5">
                            {s.items?.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between">
                                <p className="text-sm text-[#404040]">{item.description}</p>
                                <span className="text-xs text-[#8A8A8A] bg-white px-2 py-0.5 rounded shrink-0">Cant: {item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {selectedShipmentIds.length > 0 && (
                <div className="sticky bottom-0 bg-white p-3 border-t border-[#F0F0F0]">
                  <Button onClick={() => { setPendingDialog(false); setCreateDialog(true); }} className="w-full bg-[#C8102E] hover:bg-[#9B0B22]">
                    Crear Ruta con {selectedShipmentIds.length} envio{selectedShipmentIds.length !== 1 ? "s" : ""} seleccionado{selectedShipmentIds.length !== 1 ? "s" : ""}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FranchiseLayout>
  );
}
