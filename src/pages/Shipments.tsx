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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  X,
  Printer,
  ClipboardList,
  MapPin,
  CalendarDays,
  Inbox,
  Box,
  Download,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";

/* ─── tab definitions ─────────────────────────────────────────── */

type StoreTabKey = "POR_ENVIAR" | "ENVIADOS" | "POR_RECIBIR" | "EN_TIENDA" | "COMPLETADOS";
type WarehouseTabKey = "POR_RECIBIR" | "EN_BODEGA" | "EN_RUTA" | "ENTREGADOS";
type SabanaTabKey = "POR_RECIBIR" | "EN_BODEGA";

interface TabDef<T extends string> {
  key: T;
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

// Tabs for STORES (tiendas)
const STORE_TABS: TabDef<StoreTabKey>[] = [
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
    description: "Ya salieron de la tienda, en camino",
    color: "text-[#525252]",
    activeColor: "text-[#C8102E]",
    activeBg: "bg-[#FFF5F5]",
    activeBorder: "border-[#C8102E]",
    badgeColor: "bg-[#C8102E] text-white",
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
  {
    key: "EN_TIENDA",
    label: "En Tienda",
    icon: CheckCircle,
    statuses: ["RECIBIDO_EN_DESTINO"],
    description: "Recibidos en esta tienda, esperando al cliente",
    color: "text-[#525252]",
    activeColor: "text-[#1B6B3E]",
    activeBg: "bg-emerald-50",
    activeBorder: "border-[#1B6B3E]",
    badgeColor: "bg-[#1B6B3E] text-white",
  },
  {
    key: "COMPLETADOS",
    label: "Completados",
    icon: CheckCircle,
    statuses: ["RECIBIDO_EN_DESTINO"],
    description: "Enviados por esta tienda, ya entregados en destino",
    color: "text-[#525252]",
    activeColor: "text-blue-700",
    activeBg: "bg-blue-50",
    activeBorder: "border-blue-700",
    badgeColor: "bg-blue-700 text-white",
  },
];

// Tabs for WAREHOUSE (bodega)
const WAREHOUSE_TABS: TabDef<WarehouseTabKey>[] = [
  {
    key: "POR_RECIBIR",
    label: "Por Recibir",
    icon: Download,
    statuses: ["ENVIADO_A_BODEGA"],
    description: "Envios de tiendas pendientes de recepcion",
    color: "text-[#525252]",
    activeColor: "text-[#B8860B]",
    activeBg: "bg-amber-50",
    activeBorder: "border-[#B8860B]",
    badgeColor: "bg-[#B8860B] text-white",
  },
  {
    key: "EN_BODEGA",
    label: "En Bodega",
    icon: ClipboardCheck,
    statuses: ["CREADO", "RECIBIDO_EN_BODEGA"],
    description: "Creados en bodega y recibidos de tiendas",
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
    statuses: ["ENVIADO_A_DESTINO", "EN_RUTA", "EN_PARADA"],
    description: "Ya salieron de bodega, en camino a tiendas",
    color: "text-[#525252]",
    activeColor: "text-blue-700",
    activeBg: "bg-blue-50",
    activeBorder: "border-blue-700",
    badgeColor: "bg-blue-700 text-white",
  },
  {
    key: "ENTREGADOS",
    label: "Entregados",
    icon: CheckCircle,
    statuses: ["RECIBIDO_EN_DESTINO"],
    description: "Entregados en las tiendas de destino",
    color: "text-[#525252]",
    activeColor: "text-[#1B6B3E]",
    activeBg: "bg-emerald-50",
    activeBorder: "border-[#1B6B3E]",
    badgeColor: "bg-[#1B6B3E] text-white",
  },
];

// Tabs for RECEIVING WAREHOUSE (Sabana) — only receives, simplified
const SABANA_TABS: TabDef<SabanaTabKey>[] = [
  {
    key: "POR_RECIBIR",
    label: "Por Recibir",
    icon: Inbox,
    statuses: ["ENVIADO_A_DESTINO"],
    description: "Envios que vienen hacia bodega Sabana",
    color: "text-[#525252]",
    activeColor: "text-[#B8860B]",
    activeBg: "bg-amber-50",
    activeBorder: "border-[#B8860B]",
    badgeColor: "bg-[#B8860B] text-white",
  },
  {
    key: "EN_BODEGA",
    label: "En Bodega",
    icon: ClipboardCheck,
    statuses: ["RECIBIDO_EN_DESTINO"],
    description: "Envios recibidos en bodega Sabana",
    color: "text-[#525252]",
    activeColor: "text-[#C8102E]",
    activeBg: "bg-[#FFF5F5]",
    activeBorder: "border-[#C8102E]",
    badgeColor: "bg-[#C8102E] text-white",
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
    RECIBIDO_EN_DESTINO: { color: "bg-emerald-50 text-[#1B6B3E] hover:bg-emerald-100", label: "Recibido en Tienda", icon: CheckCircle },
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

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: (() => void) | null;
  }>({ open: false, title: "", description: "", action: null });

  const isWarehouse = user?.franchise?.isWarehouse === 1;
  const isReceivingWarehouse = user?.username === "bodega_sabana";
  const isBodega = isWarehouse || isReceivingWarehouse;
  const myFranchiseId = user?.franchiseId;

  // Helper: clean franchise names (remove "AMERICAN OUTLET" prefix)
  function cleanName(name: string | undefined): string {
    if (!name) return "";
    const upper = name.toUpperCase();
    if (upper.includes("GANGA")) return "Ganga Santa Rosa";
    return name.replace(/AMERICAN OUTLET\s*/i, "").trim() || name;
  }

  // Route destinations (Grecia, Palmares, San Ramon) — excluded from normal shipment filters
  const routeCodes = ["grecia", "palmares", "san_ramon"];
  const isRouteFranchise = (f: { code?: string | null; displayName?: string | null }) =>
    routeCodes.includes(f.code?.toLowerCase() || "") ||
    (f.displayName?.toLowerCase() || "").includes("recogida");

  // Store franchises: exclude warehouses AND route destinations
  const storeFranchises = (allFranchises || []).filter(
    (f) => !f.isWarehouse && !isRouteFranchise(f)
  );

  // Sabana is a receiving warehouse only — not a destination/origin for normal shipments
  const isSabana = (name: string) => name.toLowerCase().includes("sabana");

  // All origin options for warehouse users: stores + warehouses that can create shipments
  const originFranchisesForFilter = isBodega
    ? (allFranchises || []).filter((f) => !isRouteFranchise(f) && !isSabana(f.displayName || f.name || ""))
    : storeFranchises;

  // Select tabs based on user type
  const TABS = isReceivingWarehouse
    ? SABANA_TABS
    : isWarehouse
    ? WAREHOUSE_TABS
    : STORE_TABS;
  type ActiveTabKey = typeof TABS[number]["key"];

  const urlTab = searchParams.get("tab") as ActiveTabKey | null;
  const urlOriginId = searchParams.get("origin");

  const defaultTab = isBodega ? "POR_RECIBIR" : "POR_ENVIAR";
  const [activeTab, setActiveTab] = useState<ActiveTabKey>(defaultTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [originFilter, setOriginFilter] = useState<string>(urlOriginId || "ALL");
  const [destFilter, setDestFilter] = useState<string>("ALL");

  // Fix activeTab when user type (warehouse vs store) changes
  // This prevents crashes when user loads and isWarehouse flips from false to true
  useEffect(() => {
    const validKeys = TABS.map((t) => t.key);
    if (!validKeys.includes(activeTab)) {
      const fallback = urlTab && validKeys.includes(urlTab) ? urlTab : defaultTab;
      setActiveTab(fallback as ActiveTabKey);
    }
  }, [isBodega, TABS, activeTab, urlTab, defaultTab]);

  // Date filter for "Enviados" tab (stores only) — default to today, recalculated fresh on mount
  const [dateFilter, setDateFilter] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [dateFilterEnabled, setDateFilterEnabled] = useState<boolean>(true);

  // Reset date to today whenever entering ENVIADOS tab
  useEffect(() => {
    if (activeTab === "ENVIADOS" && dateFilterEnabled) {
      const today = format(new Date(), "yyyy-MM-dd");
      setDateFilter((prev) => (prev !== today ? today : prev));
    }
  }, [activeTab, dateFilterEnabled]);

  // Sync tab with URL
  useEffect(() => {
    if (urlTab && TABS.some((t) => t.key === urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab, TABS]);

  // Update URL when tab changes
  const handleTabChange = (tab: ActiveTabKey) => {
    setActiveTab(tab);
    setSelectedIds([]);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", tab);
    setSearchParams(newParams, { replace: true });
  };

  const utils = trpc.useUtils();

  // ─── Mutations ────────────────────────────────────────────────

  // Store: Confirmar salida a bodega
  const confirmarSalidaMutation = trpc.shipment.confirmarSalidaMasiva.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} envio(s) confirmado(s) como salida a bodega`);
      utils.shipment.list.invalidate();
      setSelectedIds([]);
    },
    onError: (error) => {
      toast.error(error.message || "Error al confirmar salida");
    },
  });

  // Warehouse: Recibir en bodega
  const recibirBodegaMutation = trpc.shipment.recibirEnBodegaMasiva.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} envio(s) recibido(s) en bodega`);
      utils.shipment.list.invalidate();
      setSelectedIds([]);
    },
    onError: (error) => {
      toast.error(error.message || "Error al recibir en bodega");
    },
  });

  // Warehouse: Enviar a destino
  const enviarDestinoMutation = trpc.shipment.enviarADestinoMasiva.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} envio(s) enviado(s) a destino`);
      utils.shipment.list.invalidate();
      setSelectedIds([]);
    },
    onError: (error) => {
      toast.error(error.message || "Error al enviar a destino");
    },
  });

  // Store: Recibir en destino (tienda)
  const recibirDestinoMutation = trpc.shipment.recibirEnDestinoMasiva.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} envio(s) recibido(s) en tienda`);
      utils.shipment.list.invalidate();
      setSelectedIds([]);
    },
    onError: (error) => {
      toast.error(error.message || "Error al recibir envios");
    },
  });

  // Current tab definition
  const currentTab = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  // Filter shipments by tab + search + origin/dest + date
  const filteredShipments = useMemo(() => {
    return (shipments || []).filter((s) => {
      // Tab filter (statuses)
      const matchesTab = currentTab.statuses.includes(s.status);

      // Store-specific filtering by origin/dest
      if (!isBodega && myFranchiseId) {
        // POR_ENVIAR: only show shipments CREATED BY this store
        if (activeTab === "POR_ENVIAR" && s.originFranchiseId !== myFranchiseId) return false;
        // POR_RECIBIR: only show shipments coming TO the current store
        if (activeTab === "POR_RECIBIR" && s.destinationFranchiseId !== myFranchiseId) return false;
        // EN_TIENDA: only show shipments received IN the current store (destino)
        if (activeTab === "EN_TIENDA" && s.destinationFranchiseId !== myFranchiseId) return false;
        // COMPLETADOS: only show shipments SENT FROM the current store that arrived
        if (activeTab === "COMPLETADOS" && s.originFranchiseId !== myFranchiseId) return false;
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

      // Date filter (only for store ENVIADOS tab) — compare year/month/day in local time
      let matchesDate = true;
      if (!isBodega && activeTab === "ENVIADOS" && dateFilterEnabled && dateFilter) {
        const created = s.createdAt ? new Date(String(s.createdAt)) : null;
        if (created) {
          const [fy, fm, fd] = dateFilter.split("-").map(Number);
          if (created.getFullYear() !== fy || created.getMonth() + 1 !== fm || created.getDate() !== fd) {
            matchesDate = false;
          }
        }
      }

      // Hide route shipments (Grecia, Palmares, San Ramon) from "En Bodega" tab — they are managed in the Routes page. Sabana is NOT a route, it receives at warehouse like a normal store.
      let isRouteShipment = false;
      if (isBodega && activeTab === "EN_BODEGA") {
        const destName = (s.destinationName || "").toLowerCase();
        if (destName.includes("grecia") || destName.includes("palmares") || destName.includes("san ramon")) {
          isRouteShipment = true;
        }
      }

      return matchesTab && matchesSearch && matchesOrigin && matchesDest && matchesDate && !isRouteShipment;
    });
  }, [shipments, activeTab, currentTab, searchQuery, originFilter, destFilter, dateFilter, dateFilterEnabled, isBodega, myFranchiseId]);

  // Count per tab
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tab of TABS) {
      counts[tab.key] = 0;
    }
    for (const s of shipments || []) {
      for (const tab of TABS) {
        if (!tab.statuses.includes(s.status)) continue;

        // Store-specific counting with origin/dest logic
        if (!isBodega && myFranchiseId) {
          if (tab.key === "POR_ENVIAR" && s.originFranchiseId === myFranchiseId) {
            counts[tab.key]++;
          } else if (tab.key === "POR_RECIBIR" && s.destinationFranchiseId === myFranchiseId) {
            counts[tab.key]++;
          } else if (tab.key === "EN_TIENDA" && s.destinationFranchiseId === myFranchiseId) {
            counts[tab.key]++;
          } else if (tab.key === "COMPLETADOS" && s.originFranchiseId === myFranchiseId) {
            counts[tab.key]++;
          } else if (
            tab.key !== "POR_ENVIAR" &&
            tab.key !== "POR_RECIBIR" &&
            tab.key !== "EN_TIENDA" &&
            tab.key !== "COMPLETADOS"
          ) {
            counts[tab.key]++;
          }
        } else {
          // Warehouse: exclude route shipments (Grecia, Palmares, San Ramon) from EN_BODEGA count. Sabana is NOT a route.
          if (isBodega && tab.key === "EN_BODEGA") {
            const destName = (s.destinationName || "").toLowerCase();
            if (!destName.includes("grecia") && !destName.includes("palmares") && !destName.includes("san ramon")) {
              counts[tab.key]++;
            }
          } else {
            counts[tab.key]++;
          }
        }
        // No break here — RECIBIDO_EN_DESTINO can count for both EN_TIENDA and COMPLETADOS
      }
    }
    return counts;
  }, [shipments, TABS, isBodega, myFranchiseId]);

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

  // ─── Confirmation dialog helper ───────────────────────────────

  const openConfirmDialog = (title: string, description: string, onConfirm: () => void) => {
    setConfirmDialog({ open: true, title, description, action: onConfirm });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, title: "", description: "", action: null });
  };

  // ─── Action handlers ──────────────────────────────────────────

  const confirmarSalida = () => {
    if (selectedIds.length === 0) return;
    const seleccionados = filteredShipments.filter((s) => selectedIds.includes(s.id));
    const noCreados = seleccionados.filter((s) => s.status !== "CREADO");
    if (noCreados.length > 0) {
      toast.error(`${noCreados.length} envio(s) no estan en estado CREADO`);
      return;
    }
    openConfirmDialog(
      "Confirmar Salida a Bodega",
      `Esta seguro de confirmar la salida a bodega de ${selectedIds.length} envio(s)? Esta accion no se puede deshacer.`,
      () => confirmarSalidaMutation.mutate({ ids: selectedIds })
    );
  };

  const recibirEnBodega = () => {
    if (selectedIds.length === 0) return;
    const seleccionados = filteredShipments.filter((s) => selectedIds.includes(s.id));
    const invalidos = seleccionados.filter((s) => s.status !== "ENVIADO_A_BODEGA");
    if (invalidos.length > 0) {
      toast.error(`${invalidos.length} envio(s) no estan en estado ENVIADO_A_BODEGA`);
      return;
    }
    openConfirmDialog(
      "Confirmar Recepcion en Bodega",
      `Esta seguro de confirmar la recepcion de ${selectedIds.length} envio(s) en bodega? Esta accion no se puede deshacer.`,
      () => recibirBodegaMutation.mutate({ ids: selectedIds })
    );
  };

  const enviarADestino = () => {
    if (selectedIds.length === 0) return;
    const seleccionados = filteredShipments.filter((s) => selectedIds.includes(s.id));
    const invalidos = seleccionados.filter((s) => s.status !== "RECIBIDO_EN_BODEGA" && s.status !== "CREADO");
    if (invalidos.length > 0) {
      toast.error(`${invalidos.length} envio(s) no estan en estado valido para enviar a destino`);
      return;
    }
    openConfirmDialog(
      "Confirmar Envio a Destino",
      `Esta seguro de confirmar el envio a destino de ${selectedIds.length} envio(s)? Esta accion no se puede deshacer.`,
      () => enviarDestinoMutation.mutate({ ids: selectedIds })
    );
  };

  const recibirEnDestino = () => {
    if (selectedIds.length === 0) return;
    const seleccionados = filteredShipments.filter((s) => selectedIds.includes(s.id));
    const invalidos = seleccionados.filter((s) => s.status !== "ENVIADO_A_DESTINO");
    if (invalidos.length > 0) {
      toast.error(`${invalidos.length} envio(s) no estan en estado ENVIADO_A_DESTINO`);
      return;
    }
    openConfirmDialog(
      "Confirmar Recepcion en Tienda",
      `Esta seguro de confirmar la recepcion de ${selectedIds.length} envio(s) en tienda? Esta accion no se puede deshacer.`,
      () => recibirDestinoMutation.mutate({ ids: selectedIds })
    );
  };

  // ─── Render action buttons based on tab + user type ───────────

  const renderActionButtons = () => {
    if (selectedIds.length === 0) return null;

    // STORE: Por Enviar → Confirmar Salida + Bitacora
    if (!isBodega && activeTab === "POR_ENVIAR") {
      return (
        <>
          <Button
            onClick={confirmarSalida}
            disabled={confirmarSalidaMutation.isPending}
            variant="outline"
            className="border-[#1B6B3E]/20 text-[#1B6B3E] hover:bg-emerald-50"
          >
            <Send className="w-4 h-4 mr-2" />
            {confirmarSalidaMutation.isPending ? "Procesando..." : "Confirmar Salida a Bodega"}
          </Button>
          <Button
            onClick={generateBitacora}
            variant="outline"
            className="border-[#C8102E]/20 text-[#C8102E] hover:bg-[#FFF5F5]"
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            Generar Bitacora
          </Button>
        </>
      );
    }

    // STORE: Por Recibir → Confirmar Recepcion Masiva
    if (!isBodega && activeTab === "POR_RECIBIR") {
      return (
        <>
          <Button
            onClick={recibirEnDestino}
            disabled={recibirDestinoMutation.isPending}
            variant="outline"
            className="border-[#B8860B]/20 text-[#B8860B] hover:bg-amber-50"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {recibirDestinoMutation.isPending ? "Procesando..." : "Confirmar Recepcion Masiva"}
          </Button>
          <Button
            onClick={generateBitacora}
            variant="outline"
            className="border-[#C8102E]/20 text-[#C8102E] hover:bg-[#FFF5F5]"
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            Generar Bitacora
          </Button>
        </>
      );
    }

    // WAREHOUSE: Por Recibir → Confirmar Recepcion
    if (isBodega && activeTab === "POR_RECIBIR") {
      return (
        <>
          <Button
            onClick={recibirEnBodega}
            disabled={recibirBodegaMutation.isPending}
            variant="outline"
            className="border-[#B8860B]/20 text-[#B8860B] hover:bg-amber-50"
          >
            <Download className="w-4 h-4 mr-2" />
            {recibirBodegaMutation.isPending ? "Procesando..." : "Confirmar Recepcion Masiva"}
          </Button>
          <Button
            onClick={generateBitacora}
            variant="outline"
            className="border-[#C8102E]/20 text-[#C8102E] hover:bg-[#FFF5F5]"
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            Generar Bitacora
          </Button>
        </>
      );
    }

    // WAREHOUSE: En Bodega → Enviar a Destino
    if (isBodega && activeTab === "EN_BODEGA") {
      return (
        <>
          <Button
            onClick={enviarADestino}
            disabled={enviarDestinoMutation.isPending}
            variant="outline"
            className="border-purple-700/20 text-purple-700 hover:bg-purple-50"
          >
            <Send className="w-4 h-4 mr-2" />
            {enviarDestinoMutation.isPending ? "Procesando..." : "Confirmar Envio a Destino"}
          </Button>
          <Button
            onClick={generateBitacora}
            variant="outline"
            className="border-[#C8102E]/20 text-[#C8102E] hover:bg-[#FFF5F5]"
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            Generar Bitacora
          </Button>
        </>
      );
    }

    // Default: just bitacora
    return (
      <Button
        onClick={generateBitacora}
        variant="outline"
        className="border-[#C8102E]/20 text-[#C8102E] hover:bg-[#FFF5F5]"
      >
        <ClipboardList className="w-4 h-4 mr-2" />
        Generar Bitacora
      </Button>
    );
  };

  // ─── Workflow hints ───────────────────────────────────────────

  const renderWorkflowHint = () => {
    if (selectedIds.length === 0) return null;

    // Store: Por Enviar
    if (!isBodega && activeTab === "POR_ENVIAR") {
      return (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <ClipboardCheck className="w-4 h-4 shrink-0" />
          <span className="font-medium">Flujo recomendado:</span>
          <span>1) Generar Bitacora para revisar</span>
          <span className="text-blue-400">→</span>
          <span>2) Confirmar Salida a Bodega</span>
        </div>
      );
    }

    // Store: Por Recibir
    if (!isBodega && activeTab === "POR_RECIBIR") {
      return (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <ClipboardCheck className="w-4 h-4 shrink-0" />
          <span className="font-medium">Flujo de recepcion:</span>
          <span>1) Revisar paquetes contra la bitacora</span>
          <span className="text-amber-400">→</span>
          <span>2) Confirmar Recepcion Masiva</span>
        </div>
      );
    }

    // Warehouse: Por Recibir
    if (isBodega && activeTab === "POR_RECIBIR") {
      return (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <ClipboardCheck className="w-4 h-4 shrink-0" />
          <span className="font-medium">Flujo de bodega:</span>
          <span>1) Generar Bitacora para revisar</span>
          <span className="text-amber-400">→</span>
          <span>2) Confirmar Recepcion Masiva</span>
        </div>
      );
    }

    // Warehouse: En Bodega
    if (isBodega && activeTab === "EN_BODEGA") {
      return (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700">
          <ClipboardCheck className="w-4 h-4 shrink-0" />
          <span className="font-medium">Flujo de bodega:</span>
          <span>1) Generar Bitacora para el camion</span>
          <span className="text-purple-400">→</span>
          <span>2) Confirmar Envio a Destino</span>
        </div>
      );
    }

    return null;
  };

  // ─── Date filter visibility ───────────────────────────────────

  const showDateFilter = !isBodega && activeTab === "ENVIADOS";

  return (
    <FranchiseLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">
              {isBodega ? "Bodega - Envios" : "Mis Envios"}
            </h1>
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
          <div className="flex gap-2 flex-wrap">
            {renderActionButtons()}
            {!isBodega && (
              <Link
                to="/enviar"
                className="inline-flex items-center justify-center px-4 py-2.5 bg-[#C8102E] text-white rounded-lg text-sm font-medium hover:bg-[#9B0B22] transition-colors"
              >
                <Package className="w-4 h-4 mr-2" />
                Nuevo Envio
              </Link>
            )}
          </div>
        </div>

        {/* ─── Tab Buttons ─────────────────────────────────────── */}
        <div className={`grid grid-cols-2 ${isReceivingWarehouse ? "lg:grid-cols-2" : isBodega ? "lg:grid-cols-4" : "lg:grid-cols-5"} gap-2`}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const count = tabCounts[tab.key] || 0;
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

        {/* ─── Workflow hints ──────────────────────────────────── */}
        {renderWorkflowHint()}

        {/* ─── Sub-header: tab description + date filter ───────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-[#8A8A8A]">
            <span className="font-medium text-[#525252]">{currentTab.description}</span>
            {showDateFilter && dateFilterEnabled && (
              <span className="ml-2">
                — Envios creados el{" "}
                <strong>{format(parseISO(dateFilter), "dd/MM/yyyy", { locale: es })}</strong>
              </span>
            )}
          </p>

          {/* Date filter only for store ENVIADOS tab */}
          {showDateFilter && (
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
        <div className={`grid grid-cols-1 ${isReceivingWarehouse ? "" : "sm:grid-cols-2 lg:grid-cols-3"} gap-3`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" />
            <Input
              placeholder="Buscar por tracking, remitente, factura..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 border-[#D4D4D4]"
            />
          </div>
          {isWarehouse && !isReceivingWarehouse && (
            <div className="flex gap-2">
              <select
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                className="flex-1 h-11 px-3 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E] text-[#1A1A1A] bg-white"
              >
                <option value="ALL">Todas las tiendas (origen)</option>
                {originFranchisesForFilter.map((f) => (
                  <option key={f.id} value={f.id.toString()}>
                    {cleanName(f.displayName)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!isReceivingWarehouse && (
            <div className="flex gap-2">
              <select
                value={destFilter}
                onChange={(e) => setDestFilter(e.target.value)}
                className="flex-1 h-11 px-3 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E] text-[#1A1A1A] bg-white"
              >
                <option value="ALL">Todos los destinos</option>
                {storeFranchises.map((f) => (
                  <option key={f.id} value={f.id.toString()}>
                    {cleanName(f.displayName)}
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
          )}
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
                {hasFilters || (showDateFilter && dateFilterEnabled)
                  ? "No se encontraron envios con esos filtros"
                  : "No hay envios en esta seccion"}
              </p>
              {showDateFilter && dateFilterEnabled && (
                <p className="text-xs text-[#A3A3A3] mt-2">
                  Prueba desactivar el filtro de fecha o seleccionar otra fecha de creacion
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

        {/* ─── Confirmation Dialog ─────────────────────────────── */}
        <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && closeConfirmDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmDialog.title}</DialogTitle>
              <DialogDescription>{confirmDialog.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={closeConfirmDialog}>
                Cancelar
              </Button>
              <Button
                className="bg-[#C8102E] hover:bg-[#9B0B22] text-white"
                onClick={() => {
                  confirmDialog.action?.();
                  closeConfirmDialog();
                }}
              >
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FranchiseLayout>
  );
}
