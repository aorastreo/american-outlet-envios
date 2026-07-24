import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Package,
  Search,
  ArrowRight,
  User,
  Send,
  ClipboardCheck,
  Truck,
  CheckCircle,
  Store,
  Filter,
  X,
  Printer,
  ClipboardList,
  MapPin,
  CalendarDays,
  Inbox,
  Box,
} from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/* ─── tab definitions ─────────────────────────────────────────── */

type TabKey = "POR_ENVIAR" | "ENVIADOS" | "ENTREGADOS" | "POR_RECIBIR";

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ElementType;
  statuses: string[];
  description: string;
  color: string;
  activeColor: string;
  activeBg: string;
  activeBorder: string;
  badgeColor: string;
}

const TABS: TabDef[] = [
  {
    key: "POR_ENVIAR",
    label: "Por Enviar",
    icon: Box,
    statuses: ["CREADO"],
    description: "Envios creados que aun no salen",
    color: "text-[#525252]",
    activeColor: "text-[#1A1A1A]",
    activeBg: "bg-slate-100",
    activeBorder: "border-[#1A1A1A]",
    badgeColor: "bg-slate-200 text-[#525252]",
  },
  {
    key: "ENVIADOS",
    label: "Enviados",
    icon: Truck,
    statuses: ["ENVIADO_A_BODEGA", "RECIBIDO_EN_BODEGA", "EN_RUTA", "EN_PARADA"],
    description: "Ya salieron de la tienda",
    color: "text-[#525252]",
    activeColor: "text-[#C8102E]",
    activeBg: "bg-[#FFF5F5]",
    activeBorder: "border-[#C8102E]",
    badgeColor: "bg-[#C8102E] text-white",
  },
  {
    key: "ENTREGADOS",
    label: "Entregados",
    icon: CheckCircle,
    statuses: ["RECIBIDO_EN_DESTINO"],
    description: "Ya entregados al destino",
    color: "text-[#525252]",
    activeColor: "text-[#1B6B3E]",
    activeBg: "bg-emerald-50",
    activeBorder: "border-[#1B6B3E]",
    badgeColor: "bg-[#1B6B3E] text-white",
  },
  {
    key: "POR_RECIBIR",
    label: "Por Recibir",
    icon: Inbox,
    statuses: ["ENVIADO_A_DESTINO"],
    description: "Viniendo hacia esta tienda",
    color: "text-[#525252]",
    activeColor: "text-[#B8860B]",
    activeBg: "bg-amber-50",
    activeBorder: "border-[#B8860B]",
    badgeColor: "bg-[#B8860B] text-white",
  },
];

/* ─── status badge helper ─────────────────────────────────────── */

function getStatusConfig(status: string) {
  const configs: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    CREADO: { color: "bg-slate-100 text-[#1A1A1A] hover:bg-slate-200", label: "Creado", icon: Package },
    ENVIADO_A_BODEGA: { color: "bg-amber-50 text-[#B8860B] hover:bg-amber-100", label: "Enviado a Bodega", icon: Send },
    RECIBIDO_EN_BODEGA: { color: "bg-purple-50 text-purple-700 hover:bg-purple-100", label: "En Bodega", icon: ClipboardCheck },
    EN_RUTA: { color: "bg-blue-50 text-blue-700 hover:bg-blue-100", label: "En Ruta de Camion", icon: Truck },
    EN_PARADA: { color: "bg-orange-50 text-orange-700 hover:bg-orange-100", label: "En Punto de Recogida", icon: MapPin },
    ENVIADO_A_DESTINO: { color: "bg-[#FFF5F5] text-[#C8102E] hover:bg-[#FFE0E0]", label: "Enviado a Destino", icon: Truck },
    RECIBIDO_EN_DESTINO: { color: "bg-emerald-50 text-[#1B6B3E] hover:bg-emerald-100", label: "Entregado", icon: CheckCircle },
    CANCELADO: { color: "bg-red-50 text-red-700 hover:bg-red-100", label: "Cancelado", icon: Package },
  };
  return configs[status] || { color: "bg-gray-100 text-gray-500 hover:bg-gray-200", label: status, icon: Package };
}

/* ─── component ───────────────────────────────────────────────── */

export default function Shipments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useFranchiseAuth();
  const { data: shipments, isLoading } = trpc.shipment.list.useQuery();
  const { data: allFranchises } = trpc.franchise.list.useQuery();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const urlTab = searchParams.get("tab") as TabKey | null;
  const urlOriginId = searchParams.get("origin");

  const [activeTab, setActiveTab] = useState<TabKey>(urlTab || "POR_ENVIAR");
  const [searchQuery, setSearchQuery] = useState("");
  const [originFilter, setOriginFilter] = useState<string>(urlOriginId || "ALL");
  const [destFilter, setDestFilter] = useState<string>("ALL");

  // Date filter for "Enviados" tab — default to today
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [dateFilter, setDateFilter] = useState<string>(todayStr);
  const [dateFilterEnabled, setDateFilterEnabled] = useState<boolean>(true);

  // Sync tab with URL
  useEffect(() => {
    if (urlTab && TABS.some((t) => t.key === urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  // Update URL when tab changes
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setSelectedIds([]);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", tab);
    setSearchParams(newParams, { replace: true });
  };

  const isWarehouse = user?.franchise?.isWarehouse === 1;
  const myFranchiseId = user?.franchiseId;
  const storeFranchises = (allFranchises || []).filter((f) => !f.isWarehouse);

  // Current tab definition
  const currentTab = TABS.find((t) => t.key === activeTab)!;

  // Filter shipments by tab + search + origin/dest + date (for Enviados)
  const filteredShipments = useMemo(() => {
    return (shipments || []).filter((s) => {
      // Tab filter (statuses)
      const matchesTab = currentTab.statuses.includes(s.status);

      // For POR_RECIBIR, only show shipments coming TO the current store
      // (unless warehouse, then show all)
      if (activeTab === "POR_RECIBIR" && !isWarehouse && myFranchiseId) {
        if (s.destinationFranchiseId !== myFranchiseId) return false;
      }

      // Search filter
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        s.trackingNumber.toLowerCase().includes(q) ||
        (s.senderName || "").toLowerCase().includes(q) ||
        (s.originName || "").toLowerCase().includes(q) ||
        (s.destinationName || "").toLowerCase().includes(q) ||
        (s.invoiceNumber || "").toLowerCase().includes(q);

      // Origin / Dest filters
      const matchesOrigin = originFilter === "ALL" || s.originFranchiseId.toString() === originFilter;
      const matchesDest = destFilter === "ALL" || s.destinationFranchiseId.toString() === destFilter;

      // Date filter (only for ENVIADOS tab)
      let matchesDate = true;
      if (activeTab === "ENVIADOS" && dateFilterEnabled && dateFilter) {
        const updated = s.updatedAt ? parseISO(String(s.updatedAt)) : null;
        const filterDate = parseISO(dateFilter);
        if (updated && !isSameDay(updated, filterDate)) {
          matchesDate = false;
        }
      }

      return matchesTab && matchesSearch && matchesOrigin && matchesDest && matchesDate;
    });
  }, [shipments, activeTab, currentTab, searchQuery, originFilter, destFilter, dateFilter, dateFilterEnabled, isWarehouse, myFranchiseId]);

  // Count per tab
  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = {
      POR_ENVIAR: 0,
      ENVIADOS: 0,
      ENTREGADOS: 0,
      POR_RECIBIR: 0,
    };
    for (const s of shipments || []) {
      for (const tab of TABS) {
        if (tab.statuses.includes(s.status)) {
          // For POR_RECIBIR, only count if coming to current store (unless warehouse)
          if (tab.key === "POR_RECIBIR" && !isWarehouse && myFranchiseId) {
            if (s.destinationFranchiseId === myFranchiseId) {
              counts[tab.key]++;
            }
          } else {
            counts[tab.key]++;
          }
          break;
        }
      }
    }
    return counts;
  }, [shipments, isWarehouse, myFranchiseId]);

  const renderShipmentCard = (shipment: (typeof filteredShipments)[0]) => {
    const cfg = getStatusConfig(shipment.status);
    const isSelected = selectedIds.includes(shipment.id);
    return (
      <div key={shipment.id} className="relative group">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelection(shipment.id)}
            className="border-[#D4D4D4] data-[state=checked]:bg-[#C8102E] data-[state=checked]:border-[#C8102E]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <Link to={`/envios/${shipment.id}`} className="block">
          <Card
            className={`hover:shadow-md transition-shadow cursor-pointer border-[#F0F0F0] ${
              isSelected ? "ring-2 ring-[#C8102E]/20 border-[#C8102E]/30 bg-[#FFF5F5]/50" : ""
            }`}
          >
            <CardContent className="p-4 pl-10">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-semibold font-mono text-[#C8102E] text-lg">{shipment.trackingNumber}</p>
                    {cfg && (
                      <Badge variant="secondary" className={cfg.color}>
                        <cfg.icon className="w-3 h-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-sm text-[#8A8A8A]">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {shipment.senderName}
                    </span>
                    {shipment.invoiceNumber && (
                      <span className="text-[#A3A3A3]">| Fac: #{shipment.invoiceNumber}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-[#8A8A8A]">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFF5F5] text-[#C8102E] rounded text-xs font-medium">
                      <Store className="w-3 h-3" />
                      {shipment.originName}
                    </span>
                    <ArrowRight className="w-4 h-4 text-[#D4D4D4]" />
                    {shipment.destinationName?.toLowerCase().includes("recogida") ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs font-bold border border-orange-200">
                        <MapPin className="w-3 h-3" />
                        {shipment.destinationName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-[#1B6B3E] rounded text-xs font-medium">
                        {shipment.destinationName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-xs text-[#A3A3A3]">
                    {shipment.updatedAt
                      ? format(new Date(shipment.updatedAt), "dd/MM/yyyy HH:mm", { locale: es })
                      : shipment.createdAt
                        ? format(new Date(shipment.createdAt), "dd/MM/yyyy HH:mm", { locale: es })
                        : "-"}
                  </p>
                  <p className="text-xs text-[#8A8A8A]">{shipment.currentLocationName}</p>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open(`/boleta/${shipment.id}`, "_blank");
                    }}
                    className="inline-flex items-center gap-1 text-xs text-[#C8102E] hover:text-[#9B0B22] hover:underline mt-1 font-medium"
                  >
                    <Printer className="w-3 h-3" />
                    Boleta
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    );
  };

  const hasFilters = searchQuery !== "" || originFilter !== "ALL" || destFilter !== "ALL";

  const clearFilters = () => {
    setSearchQuery("");
    setOriginFilter("ALL");
    setDestFilter("ALL");
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllVisible = () => {
    const allSelected = filteredShipments.every((s) => selectedIds.includes(s.id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredShipments.find((s) => s.id === id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...filteredShipments.map((s) => s.id)])]);
    }
  };

  const generateBitacora = () => {
    if (selectedIds.length === 0) return;
    const idsParam = selectedIds.join(",");
    window.open(`/bitacora?ids=${idsParam}`, "_blank");
  };

  return (
    <FranchiseLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Mis Envios</h1>
            <p className="text-[#8A8A8A] mt-1">
              {filteredShipments.length} envio{filteredShipments.length !== 1 ? "s" : ""} encontrado
              {filteredShipments.length !== 1 ? "s" : ""}
              {selectedIds.length > 0 && (
                <span className="ml-2 text-[#C8102E] font-medium">
                  ({selectedIds.length} seleccionado{selectedIds.length !== 1 ? "s" : ""})
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <Button
                onClick={generateBitacora}
                variant="outline"
                className="border-[#C8102E]/20 text-[#C8102E] hover:bg-[#FFF5F5]"
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                Generar Bitacora
              </Button>
            )}
            <Link
              to="/enviar"
              className="inline-flex items-center justify-center px-4 py-2.5 bg-[#C8102E] text-white rounded-lg text-sm font-medium hover:bg-[#9B0B22] transition-colors"
            >
              <Package className="w-4 h-4 mr-2" />
              Nuevo Envio
            </Link>
          </div>
        </div>

        {/* ─── Tab Buttons ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const count = tabCounts[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`relative flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                  isActive
                    ? `${tab.activeBg} ${tab.activeBorder} shadow-sm`
                    : "bg-white border-[#E5E5E5] hover:bg-[#FAFAFA] hover:border-[#D4D4D4]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${isActive ? tab.activeColor : tab.color}`} />
                  <span className={`text-sm font-semibold ${isActive ? tab.activeColor : tab.color}`}>
                    {tab.label}
                  </span>
                </div>
                <Badge
                  className={`text-xs font-bold ${
                    isActive ? tab.badgeColor : "bg-[#F0F0F0] text-[#8A8A8A]"
                  }`}
                >
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* ─── Sub-header: tab description + date filter for Enviados ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-[#8A8A8A]">
            <span className="font-medium text-[#525252]">{currentTab.description}</span>
            {activeTab === "ENVIADOS" && dateFilterEnabled && (
              <span className="ml-2">
                — Mostrando{" "}
                <strong>{format(parseISO(dateFilter), "dd/MM/yyyy", { locale: es })}</strong>
              </span>
            )}
          </p>

          {/* Date filter only for ENVIADOS tab */}
          {activeTab === "ENVIADOS" && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm text-[#525252] cursor-pointer select-none">
                <Checkbox
                  checked={dateFilterEnabled}
                  onCheckedChange={(checked) => setDateFilterEnabled(checked === true)}
                  className="border-[#D4D4D4] data-[state=checked]:bg-[#C8102E] data-[state=checked]:border-[#C8102E]"
                />
                <CalendarDays className="w-3.5 h-3.5 text-[#8A8A8A]" />
                Filtrar por fecha
              </label>
              {dateFilterEnabled && (
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="h-9 px-3 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E] text-[#1A1A1A]"
                />
              )}
            </div>
          )}
        </div>

        {/* ─── Search + Filters ────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" />
            <Input
              placeholder="Buscar por tracking, remitente, factura..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 border-[#D4D4D4]"
            />
          </div>
          {isWarehouse && (
            <div className="flex gap-2">
              <select
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                className="flex-1 h-11 px-3 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E] text-[#1A1A1A] bg-white"
              >
                <option value="ALL">Todas las tiendas (origen)</option>
                {storeFranchises.map((f) => (
                  <option key={f.id} value={f.id.toString()}>
                    {f.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <select
              value={destFilter}
              onChange={(e) => setDestFilter(e.target.value)}
              className="flex-1 h-11 px-3 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E] text-[#1A1A1A] bg-white"
            >
              <option value="ALL">Todos los destinos</option>
              {storeFranchises.map((f) => (
                <option key={f.id} value={f.id.toString()}>
                  {f.displayName}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="h-11 px-3 rounded-lg border border-[#D4D4D4] text-[#8A8A8A] hover:bg-[#F0F0F0] transition-colors shrink-0"
                title="Limpiar filtros"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ─── Shipment List ───────────────────────────────────── */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8102E]"></div>
          </div>
        ) : filteredShipments.length === 0 ? (
          <Card className="border-[#D4D4D4]">
            <CardContent className="p-12 text-center">
              <Package className="w-12 h-12 text-[#D4D4D4] mx-auto mb-3" />
              <p className="text-[#8A8A8A]">
                {hasFilters || (activeTab === "ENVIADOS" && dateFilterEnabled)
                  ? "No se encontraron envios con esos filtros"
                  : "No hay envios en esta seccion"}
              </p>
              {activeTab === "ENVIADOS" && dateFilterEnabled && (
                <p className="text-xs text-[#A3A3A3] mt-2">
                  Prueba desactivar el filtro de fecha o seleccionar otra fecha
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Select all */}
            {filteredShipments.length > 1 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-[#F7F7F7] rounded-lg border border-[#D4D4D4]">
                <Checkbox
                  checked={filteredShipments.every((s) => selectedIds.includes(s.id))}
                  onCheckedChange={selectAllVisible}
                  className="border-[#D4D4D4] data-[state=checked]:bg-[#C8102E] data-[state=checked]:border-[#C8102E]"
                />
                <span className="text-sm text-[#525252] font-medium">Seleccionar todos los visibles</span>
                <span className="text-xs text-[#A3A3A3] ml-1">({filteredShipments.length})</span>
              </div>
            )}
            {filteredShipments.map((s) => renderShipmentCard(s))}
          </div>
        )}
      </div>
    </FranchiseLayout>
  );
}
