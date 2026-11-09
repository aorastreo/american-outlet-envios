import { useState, useMemo, useEffect, useRef } from "react";
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
  X,
  Printer,
  ClipboardList,
  MapPin,
  CalendarDays,
  Inbox,
  Box,
  Download,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";
import { getFranchiseGroup, isRetiredFranchise, mixedShipmentMoveMessage, needsInterBodega, shipmentPlaceText } from "@/lib/franchise-groups";
import ShipmentCheckBar from "@/components/ShipmentCheckBar";

/* ─── tab definitions ─────────────────────────────────────────── */

type StoreTabKey = "POR_ENVIAR" | "ENVIADOS" | "POR_RECIBIR" | "EN_TIENDA" | "COMPLETADOS" | "CANCELADOS";
type WarehouseTabKey = "POR_RECIBIR" | "EN_BODEGA" | "ENTREGA_CLIENTE" | "EN_RUTA" | "ENTREGADOS" | "CANCELADOS";
type SabanaTabKey = "POR_RECIBIR" | "EN_BODEGA" | "CANCELADOS";

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
    statuses: ["ENVIADO_A_BODEGA", "RECIBIDO_EN_BODEGA", "ENVIADO_A_DESTINO", "EN_RUTA", "EN_PARADA", "NO_RECOGIDO"],
    description: "Ya salieron de la tienda y siguen en camino hasta que el destino los reciba",
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
    description: "Ya salieron de bodega y vienen hacia esta tienda",
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
    statuses: ["RECIBIDO_EN_DESTINO", "ENTREGADO_AL_CLIENTE"],
    description: "Enviados por esta tienda, ya entregados en destino",
    color: "text-[#525252]",
    activeColor: "text-blue-700",
    activeBg: "bg-blue-50",
    activeBorder: "border-blue-700",
    badgeColor: "bg-blue-700 text-white",
  },
  {
    key: "CANCELADOS",
    label: "Cancelados",
    icon: AlertTriangle,
    statuses: ["CANCELADO"],
    description: "Envios cancelados. Ya no siguen en camino",
    color: "text-[#525252]",
    activeColor: "text-red-700",
    activeBg: "bg-red-50",
    activeBorder: "border-red-700",
    badgeColor: "bg-red-700 text-white",
  },
];

// Tabs for WAREHOUSE (bodega)
const WAREHOUSE_TABS: TabDef<WarehouseTabKey>[] = [
  {
    key: "POR_RECIBIR",
    label: "Por Recibir",
    icon: Download,
    statuses: ["ENVIADO_A_BODEGA"],
    description: "Envios que ya salieron y vienen hacia esta bodega",
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
    description: "Envios listos para enviar a destino o a otra bodega",
    color: "text-[#525252]",
    activeColor: "text-purple-700",
    activeBg: "bg-purple-50",
    activeBorder: "border-purple-700",
    badgeColor: "bg-purple-700 text-white",
  },
  {
    key: "ENTREGA_CLIENTE",
    label: "Entrega a Cliente",
    icon: User,
    statuses: ["RECIBIDO_EN_BODEGA"],
    description: "Envios recibidos de tiendas que el cliente retira en bodega",
    color: "text-[#525252]",
    activeColor: "text-teal-700",
    activeBg: "bg-teal-50",
    activeBorder: "border-teal-700",
    badgeColor: "bg-teal-700 text-white",
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
    statuses: ["RECIBIDO_EN_DESTINO", "ENTREGADO_AL_CLIENTE"],
    description: "Llegaron a la tienda o el cliente ya los retiro",
    color: "text-[#525252]",
    activeColor: "text-[#1B6B3E]",
    activeBg: "bg-emerald-50",
    activeBorder: "border-[#1B6B3E]",
    badgeColor: "bg-[#1B6B3E] text-white",
  },
  {
    key: "CANCELADOS",
    label: "Cancelados",
    icon: AlertTriangle,
    statuses: ["CANCELADO"],
    description: "Envios cancelados. Ya no siguen en camino",
    color: "text-[#525252]",
    activeColor: "text-red-700",
    activeBg: "bg-red-50",
    activeBorder: "border-red-700",
    badgeColor: "bg-red-700 text-white",
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
  {
    key: "CANCELADOS",
    label: "Cancelados",
    icon: AlertTriangle,
    statuses: ["CANCELADO"],
    description: "Envios cancelados. Ya no siguen en camino",
    color: "text-[#525252]",
    activeColor: "text-red-700",
    activeBg: "bg-red-50",
    activeBorder: "border-red-700",
    badgeColor: "bg-red-700 text-white",
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
    ENTREGADO_AL_CLIENTE: { color: "bg-emerald-50 text-[#1B6B3E] hover:bg-emerald-100", label: "Entregado al cliente", icon: CheckCircle },
    NO_RECOGIDO: { color: "bg-red-50 text-red-700 hover:bg-red-100", label: "No recogido", icon: AlertTriangle },
    CANCELADO: { color: "bg-red-50 text-red-700 hover:bg-red-100", label: "Cancelado", icon: Package },
  };
  return configs[status] || { color: "bg-gray-100 text-gray-500 hover:bg-gray-200", label: status, icon: Package };
}

/* ─── component ───────────────────────────────────────────────── */

export default function Shipments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useFranchiseAuth();

  const isBodega = user?.franchise?.isWarehouse === 1;

  const listQuery = trpc.shipment.list.useQuery();
  const listSentQuery = trpc.shipment.listSent.useQuery();
  const { data: allFranchises } = trpc.franchise.list.useQuery();
  const isCediWarehouse = `${user?.franchise?.name || ""} ${user?.franchise?.displayName || ""} ${user?.username || ""}`.toLowerCase().includes("cedi");
  const { data: routePickupShipments } = trpc.route.getRouteShipments.useQuery(undefined, {
    enabled: isCediWarehouse,
  });
  const stuckIds = useMemo(
    () => new Set((routePickupShipments || []).filter((s) => s.stuckAfterRoute).map((s) => s.id)),
    [routePickupShipments],
  );

  const [reviewGroup, setReviewGroup] = useState<string | null>(null);
  const [showTrips, setShowTrips] = useState(false);
  const [receiverDraft, setReceiverDraft] = useState("");

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    askName: boolean;
  }>({ open: false, title: "", description: "", askName: false });
  const confirmActionRef = useRef<(() => void) | null>(null);
  const receiverDraftRef = useRef("");
  const goToTabRef = useRef<(tab: "EN_RUTA") => void>(() => {});
  const pendingTargetRef = useRef("la otra bodega");
  const [bulkMessage, setBulkMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const notify = (tone: "ok" | "error", text: string) => {
    setBulkMessage({ tone, text });
    if (tone === "error") toast.error(text);
    else toast.success(text);
  };

  const isWarehouse = user?.franchise?.isWarehouse === 1;
  const isReceivingWarehouse = user?.username === "bodega_sabana";
  // isBodega ya definido arriba (linea 241)
  const myFranchiseId = user?.franchiseId;

  // Helper: clean franchise names (remove "AMERICAN OUTLET" prefix)
  function cleanName(name: string | undefined): string {
    if (!name) return "";
    return name.replace(/AMERICAN OUTLET\s*/i, "").trim() || name;
  }

  // Helper: classify franchise by group (mio, vendedor, route, warehouse, sabana)
  // Note: route pickups (Grecia, Palmares, San Ramon) and Sabana are associated with the vendor group (Cedi)
  const routeCodes = ["grecia", "palmares", "san_ramon"];
  const isRouteFranchise = (f: { code?: string | null; displayName?: string | null }) =>
    routeCodes.includes(f.code?.toLowerCase() || "") ||
    (f.displayName?.toLowerCase() || "").includes("recogida");

  // Destinations a warehouse can filter: stores, Sabana, pickup points, and Bodega Cedi.
  const destinationFranchisesForFilter = (allFranchises || []).filter((f) => {
    if (isRetiredFranchise(f)) return false;
    const code = f.code?.toLowerCase() || "";
    if (code === "bodega_sabana" || code === "bodega_cedi") return true;
    if (isRouteFranchise(f)) return true;
    return !f.isWarehouse;
  });

  // Sabana is a receiving warehouse — available as destination for all stores
  const isSabana = (name: string) => name.toLowerCase().includes("sabana");

  // Helper: check if a shipment's destination is a warehouse (uses loaded franchises)
  const isDestWarehouse = (shipment: any) => {
    const destFranchiseId = Number(shipment.destinationFranchiseId);
    const dest = (allFranchises || []).find((f) => Number(f.id) === destFranchiseId);
    return dest?.isWarehouse === 1;
  };

  // All origin options for warehouse users: stores + warehouses that can create shipments
  const originFranchisesForFilter = (isBodega
    ? (allFranchises || []).filter((f) => !isRouteFranchise(f))
    : destinationFranchisesForFilter
  ).filter((f) => !isRetiredFranchise(f));

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
  const [originFilter, setOriginFilter] = useState<string[]>(urlOriginId ? [urlOriginId] : []);
  const [originDropdownOpen, setOriginDropdownOpen] = useState(false);
  const originDropdownRef = useRef<HTMLDivElement>(null);
  const [destFilter, setDestFilter] = useState<string[]>([]);
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);
  const destDropdownRef = useRef<HTMLDivElement>(null);

  // Fix activeTab when user type (warehouse vs store) changes
  // This prevents crashes when user loads and isWarehouse flips from false to true
  useEffect(() => {
    const validKeys = TABS.map((t) => t.key);
    if (!validKeys.includes(activeTab)) {
      const fallback = urlTab && validKeys.includes(urlTab) ? urlTab : defaultTab;
      setActiveTab(fallback as ActiveTabKey);
    }
  }, [isBodega, TABS, activeTab, urlTab, defaultTab]);

  // Date filter for the store "Enviados" tab. Off until the store turns it on.
  // The date field starts on today, and keeps whatever day the store picks.
  const [dateFilter, setDateFilter] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [dateFilterEnabled, setDateFilterEnabled] = useState<boolean>(false);
  const [historyPick, setHistoryPick] = useState<string | null>(null);

  // Sync tab with URL
  useEffect(() => {
    if (urlTab && TABS.some((t) => t.key === urlTab)) {
      setActiveTab(urlTab);
      if (["ENVIADOS", "COMPLETADOS", "EN_RUTA", "ENTREGADOS"].includes(urlTab) || (!isReceivingWarehouse && urlTab === "CANCELADOS")) {
        setHistoryPick(urlTab);
      }
    }
  }, [urlTab, TABS, isReceivingWarehouse]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (destDropdownRef.current && !destDropdownRef.current.contains(e.target as Node)) {
        setDestDropdownOpen(false);
      }
      if (originDropdownRef.current && !originDropdownRef.current.contains(e.target as Node)) {
        setOriginDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update URL when tab changes
  const handleTabChange = (tab: ActiveTabKey) => {
    setActiveTab(tab);
    setReviewGroup(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", tab);
    setSearchParams(newParams, { replace: true });
  };
  goToTabRef.current = (tab) => handleTabChange(tab as ActiveTabKey);

  // Base shipments from list query (always used for tab counts)
  const baseShipments = listQuery.data;
  const stuckOnList = (baseShipments || []).filter((s) => stuckIds.has(s.id));
  // Inter-bodega shipments in transit (for EN_RUTA tab display only)
  const interBodegaEnRuta = (listSentQuery.data || []).filter(
    (s) => s.status === "ENVIADO_A_BODEGA"
  );
  // Display shipments: combine for EN_RUTA tab, use base for others
  const isEnRutaTab = activeTab === "EN_RUTA";
  const shipments = isEnRutaTab && isBodega
    ? [...(baseShipments || []), ...interBodegaEnRuta]
    : baseShipments;
  const isLoading = listQuery.isLoading || (isEnRutaTab && isBodega ? listSentQuery.isLoading : false);

  const utils = trpc.useUtils();

  const checkMode: "salida" | "recepcion" | "entrega" | null =
    (!isBodega && activeTab === "POR_ENVIAR") || (isBodega && !isReceivingWarehouse && activeTab === "EN_BODEGA")
      ? "salida"
      : activeTab === "POR_RECIBIR"
        ? "recepcion"
        : !isBodega && activeTab === "EN_TIENDA"
          ? "entrega"
          : null;
  const markTab = activeTab === "POR_ENVIAR" || activeTab === "POR_RECIBIR" || activeTab === "EN_BODEGA" || activeTab === "EN_TIENDA"
    ? activeTab
    : null;

  const marksQuery = trpc.shipment.marks.useQuery(
    { tab: markTab ?? "POR_ENVIAR" },
    { enabled: checkMode !== null && markTab !== null, refetchInterval: checkMode ? 4000 : false },
  );
  const selectedIds = checkMode && markTab ? (marksQuery.data?.ids ?? []) : [];
  const tripsQuery = trpc.shipment.recentTrips.useQuery(undefined, { refetchInterval: 10000 });

  const addMarks = trpc.shipment.addMarks.useMutation({
    onMutate: async ({ tab, ids }) => {
      await utils.shipment.marks.cancel({ tab });
      const prev = utils.shipment.marks.getData({ tab });
      const current = prev?.ids ?? [];
      utils.shipment.marks.setData({ tab }, { ids: [...new Set([...current, ...ids])] });
      return { prev };
    },
    onError: (error, variables, ctx) => {
      utils.shipment.marks.setData({ tab: variables.tab }, ctx?.prev ?? { ids: [] });
      toast.error(error.message || "No se guardo la marca");
    },
    onSettled: (_data, _error, variables) => {
      utils.shipment.marks.invalidate({ tab: variables.tab });
    },
  });

  const removeMarks = trpc.shipment.removeMarks.useMutation({
    onMutate: async ({ tab, ids }) => {
      await utils.shipment.marks.cancel({ tab });
      const prev = utils.shipment.marks.getData({ tab });
      const current = prev?.ids ?? [];
      const gone = new Set(ids);
      utils.shipment.marks.setData({ tab }, { ids: current.filter((id) => !gone.has(id)) });
      return { prev };
    },
    onError: (error, variables, ctx) => {
      utils.shipment.marks.setData({ tab: variables.tab }, ctx?.prev ?? { ids: [] });
      toast.error(error.message || "No se pudo quitar la marca");
    },
    onSettled: (_data, _error, variables) => {
      utils.shipment.marks.invalidate({ tab: variables.tab });
    },
  });

  const forgetMarks = (ids: number[]) => {
    utils.shipment.recentTrips.invalidate();
    if (!markTab || ids.length === 0) return;
    const prev = utils.shipment.marks.getData({ tab: markTab });
    if (prev) {
      const gone = new Set(ids);
      utils.shipment.marks.setData({ tab: markTab }, { ids: prev.ids.filter((id) => !gone.has(id)) });
    }
    utils.shipment.marks.invalidate({ tab: markTab });
  };

  // ─── Mutations ────────────────────────────────────────────────

  // Store: Confirmar salida a bodega
  const confirmarSalidaMutation = trpc.shipment.confirmarSalidaMasiva.useMutation({
    onSuccess: (data, variables) => {
      toast.success(`${data.count} envio(s) confirmado(s) como salida a bodega`);
      utils.shipment.list.invalidate();
      forgetMarks(variables.ids);
    },
    onError: (error) => {
      toast.error(error.message || "Error al confirmar salida");
    },
  });

  // Warehouse: Recibir en bodega
  const recibirBodegaMutation = trpc.shipment.recibirEnBodegaMasiva.useMutation({
    onSuccess: (data, variables) => {
      toast.success(`${data.count} envio(s) recibido(s) en bodega`);
      utils.shipment.list.invalidate();
      forgetMarks(variables.ids);
    },
    onError: (error) => {
      toast.error(error.message || "Error al recibir en bodega");
    },
  });

  // Warehouse: Enviar a destino
  const enviarDestinoMutation = trpc.shipment.enviarADestinoMasiva.useMutation({
    onSuccess: (data, variables) => {
      toast.success(`${data.count} envio(s) enviado(s) a destino`);
      utils.shipment.list.invalidate();
      forgetMarks(variables.ids);
    },
    onError: (error) => {
      toast.error(error.message || "Error al enviar a destino");
    },
  });

  // Warehouse: Enviar a otra bodega (inter-bodega)
  const enviarInterBodegaMutation = trpc.shipment.enviarAInterBodegaMasiva.useMutation({
    onSuccess: (data, variables) => {
      const text = `${data.count} envio(s) salieron hacia ${pendingTargetRef.current}. Ahora estan en En Ruta.`;
      notify("ok", text);
      utils.shipment.list.invalidate();
      utils.shipment.listSent.invalidate();
      forgetMarks(variables.ids);
      goToTabRef.current("EN_RUTA");
    },
    onError: (error) => {
      notify("error", error.message || "No se pudo enviar a la otra bodega");
    },
  });

  // Store: Recibir en destino (tienda)
  const entregarClienteMutation = trpc.shipment.entregarAlClienteMasiva.useMutation({
    onSuccess: (data, variables) => {
      toast.success(`${data.count} envio(s) entregado(s) al cliente`);
      utils.shipment.list.invalidate();
      forgetMarks(variables.ids);
    },
    onError: (error) => {
      toast.error(error.message || "Error al entregar al cliente");
    },
  });

  const entregarEnTiendaMutation = trpc.shipment.entregarEnTiendaMasiva.useMutation({
    onSuccess: (data, variables) => {
      toast.success(`${data.count} envio(s) entregado(s) al cliente`);
      utils.shipment.list.invalidate();
      forgetMarks(variables.ids);
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo entregar al cliente");
    },
  });

  const recibirDestinoMutation = trpc.shipment.recibirEnDestinoMasiva.useMutation({
    onSuccess: (data, variables) => {
      toast.success(`${data.count} envio(s) recibido(s) en tienda`);
      utils.shipment.list.invalidate();
      forgetMarks(variables.ids);
    },
    onError: (error) => {
      toast.error(error.message || "Error al recibir envios");
    },
  });

  // Current tab definition
  const currentTab = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  // IDs of inter-bodega shipments in transit (for EN_RUTA tab filtering)
  const interBodegaIds = useMemo(
    () => new Set(interBodegaEnRuta.map((s) => s.id)),
    [interBodegaEnRuta]
  );

  // Filter shipments by tab + search + origin/dest + date
  const filteredShipments = useMemo(() => {
    return (shipments || []).filter((s) => {
      // A package left on a finished route is not still on the truck.
      if (activeTab === "EN_RUTA" && stuckIds.has(s.id)) return false;

      // Tab filter (statuses)
      // For EN_RUTA in warehouse: also show inter-bodega shipments (ENVIADO_A_BODEGA)
      let matchesTab =
        activeTab === "EN_RUTA" && isBodega && interBodegaIds.has(s.id)
          ? true
          : currentTab.statuses.includes(s.status);

      // Store-specific filtering by origin/dest
      if (!isBodega && myFranchiseId) {
        // POR_ENVIAR: only show shipments CREATED BY this store
        if (activeTab === "POR_ENVIAR" && s.originFranchiseId !== myFranchiseId) return false;
        // ENVIADOS: only show shipments SENT FROM this store
        if (activeTab === "ENVIADOS" && s.originFranchiseId !== myFranchiseId) return false;
        // POR_RECIBIR: only show shipments coming TO the current store
        if (activeTab === "POR_RECIBIR" && (s.destinationFranchiseId !== myFranchiseId || s.originFranchiseId === myFranchiseId)) return false;
        // EN_TIENDA: only show shipments received IN the current store (destino)
        if (activeTab === "EN_TIENDA" && s.destinationFranchiseId !== myFranchiseId) return false;
        // COMPLETADOS: only show shipments SENT FROM the current store that arrived
        if (activeTab === "COMPLETADOS") {
          const sentByMe = s.originFranchiseId === myFranchiseId;
          const handedHere = s.destinationFranchiseId === myFranchiseId && s.status === "ENTREGADO_AL_CLIENTE";
          if (!sentByMe && !handedHere) return false;
        }
      }

      // Warehouse-specific: EN_BODEGA tab — CREADO only if created FROM warehouse, exclude if dest IS this warehouse.
      // Sabana uses this tab for packages that already arrived there.
      if (isBodega && !isReceivingWarehouse && activeTab === "EN_BODEGA") {
        const originFranchise = allFranchises?.find((f) => f.id === s.originFranchiseId);
        if (s.status === "CREADO" && !originFranchise?.isWarehouse) return false;
        if (s.destinationFranchiseId === myFranchiseId) return false; // dest is THIS bodega, goes to ENTREGA_CLIENTE
      }
      // Warehouse-specific: ENTREGA_CLIENTE tab — only if dest IS this bodega + RECIBIDO_EN_BODEGA
      if (isBodega && activeTab === "ENTREGA_CLIENTE") {
        if (s.destinationFranchiseId !== myFranchiseId || s.status !== "RECIBIDO_EN_BODEGA") return false;
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
      const matchesOrigin = originFilter.length === 0 || originFilter.includes(s.originFranchiseId.toString());
      const matchesDest = destFilter.length === 0 || destFilter.includes(s.destinationFranchiseId.toString());

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

      // Hide route shipments (Grecia, Palmares, San Ramon) from "En Bodega" tab
      // ONLY if they are already in Bodega Cedi (managed in Routes page).
      // If they are in Bodega Pavon, they MUST show in En Bodega to be sent to Cedi.
      let isRouteShipment = false;
      if (isBodega && activeTab === "EN_BODEGA") {
        const destName = (s.destinationName || "").toLowerCase();
        const isRouteDest = destName.includes("grecia") || destName.includes("palmares") || destName.includes("san ramon");
        if (isRouteDest && s.warehouseLocation === "Bodega Cedi") {
          isRouteShipment = true; // In Cedi, route shipments go to Routes page
        }
      }

      return matchesTab && matchesSearch && matchesOrigin && matchesDest && matchesDate && !isRouteShipment;
    });
  }, [shipments, activeTab, currentTab, searchQuery, originFilter, destFilter, dateFilter, dateFilterEnabled, isBodega, myFranchiseId, interBodegaIds, stuckIds]);

  // A search only looks at the open tab. Point to the section that actually has the package.
  const searchElsewhere = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const visible = new Set(filteredShipments.map((s) => s.id));
    const pool = new Map<number, {
      id: number;
      status: string;
      trackingNumber: string;
      senderName?: string | null;
      originName?: string | null;
      destinationName?: string | null;
      invoiceNumber?: string | null;
      originFranchiseId: number;
      destinationFranchiseId: number;
      warehouseLocation?: string | null;
      reservedOnRoute?: boolean;
    }>();
    for (const s of baseShipments || []) pool.set(s.id, s);
    for (const s of interBodegaEnRuta) if (!pool.has(s.id)) pool.set(s.id, s);

    const tabLabel = (key: string) => TABS.find((tab) => tab.key === key)?.label || key;
    const hits: { id: number; trackingNumber: string; label: string; tab?: string; href?: string }[] = [];
    for (const s of pool.values()) {
      if (visible.has(s.id)) continue;
      const matches =
        s.trackingNumber.toLowerCase().includes(q) ||
        (s.senderName || "").toLowerCase().includes(q) ||
        (s.originName || "").toLowerCase().includes(q) ||
        (s.destinationName || "").toLowerCase().includes(q) ||
        (s.invoiceNumber || "").toLowerCase().includes(q);
      if (!matches) continue;
      if (originFilter.length > 0 && !originFilter.includes(String(s.originFranchiseId))) continue;
      if (destFilter.length > 0 && !destFilter.includes(String(s.destinationFranchiseId))) continue;

      let place: { label: string; tab?: string; href?: string } | null = null;
      if (s.status === "CANCELADO") place = { label: `la seccion ${tabLabel("CANCELADOS")}`, tab: "CANCELADOS" };
      else if (stuckIds.has(s.id)) place = { label: "Rutas, para corregir", href: "/rutas" };
      else if (!isBodega && myFranchiseId) {
        if (s.originFranchiseId === myFranchiseId && s.status === "CREADO") place = { label: `la seccion ${tabLabel("POR_ENVIAR")}`, tab: "POR_ENVIAR" };
        else if (s.originFranchiseId === myFranchiseId && ["ENVIADO_A_BODEGA", "RECIBIDO_EN_BODEGA", "ENVIADO_A_DESTINO", "EN_RUTA", "EN_PARADA", "NO_RECOGIDO"].includes(s.status)) {
          place = { label: `la seccion ${tabLabel("ENVIADOS")}`, tab: "ENVIADOS" };
        } else if (s.destinationFranchiseId === myFranchiseId && s.originFranchiseId !== myFranchiseId && s.status === "ENVIADO_A_DESTINO") {
          place = { label: `la seccion ${tabLabel("POR_RECIBIR")}`, tab: "POR_RECIBIR" };
        } else if (s.destinationFranchiseId === myFranchiseId && s.originFranchiseId !== myFranchiseId && s.status === "RECIBIDO_EN_BODEGA") {
          place = { label: "bodega. Todavia no se puede recibir" };
        } else if (s.destinationFranchiseId === myFranchiseId && s.originFranchiseId !== myFranchiseId && s.status === "ENVIADO_A_BODEGA") {
          place = { label: "camino a la bodega. Todavia no se puede recibir" };
        } else if (s.destinationFranchiseId === myFranchiseId && s.status === "RECIBIDO_EN_DESTINO") {
          place = { label: `la seccion ${tabLabel("EN_TIENDA")}`, tab: "EN_TIENDA" };
        } else if (s.originFranchiseId === myFranchiseId && s.status === "RECIBIDO_EN_DESTINO") {
          place = { label: `la seccion ${tabLabel("COMPLETADOS")}`, tab: "COMPLETADOS" };
        }
      } else if (isReceivingWarehouse) {
        if (s.status === "ENVIADO_A_DESTINO") place = { label: `la seccion ${tabLabel("POR_RECIBIR")}`, tab: "POR_RECIBIR" };
        else if (s.status === "RECIBIDO_EN_DESTINO") place = { label: `la seccion ${tabLabel("EN_BODEGA")}`, tab: "EN_BODEGA" };
      } else {
        const dest = (s.destinationName || "").toLowerCase();
        const isRoute = dest.includes("grecia") || dest.includes("palmares") || dest.includes("san ramon");
        const atCedi = s.warehouseLocation === "Bodega Cedi";
        if (isRoute && atCedi && s.status === "NO_RECOGIDO" && !s.reservedOnRoute) {
          place = { label: "Rutas, en No recogidos", href: "/rutas?tab=NO_RECOGIDOS" };
        } else if (isRoute && atCedi && s.reservedOnRoute) {
          place = { label: "Rutas", href: "/rutas" };
        } else if (isRoute && atCedi && (s.status === "RECIBIDO_EN_BODEGA" || (s.status === "CREADO" && (s.originName || "").toLowerCase().includes("bodega")))) {
          place = { label: "Rutas, esperando el camion", href: "/rutas" };
        } else if (s.status === "ENVIADO_A_BODEGA" && interBodegaIds.has(s.id)) {
          place = { label: `la seccion ${tabLabel("EN_RUTA")}`, tab: "EN_RUTA" };
        } else if (s.status === "ENVIADO_A_BODEGA") {
          place = { label: `la seccion ${tabLabel("POR_RECIBIR")}`, tab: "POR_RECIBIR" };
        } else if (s.status === "RECIBIDO_EN_BODEGA" && s.destinationFranchiseId === myFranchiseId) {
          place = { label: `la seccion ${tabLabel("ENTREGA_CLIENTE")}`, tab: "ENTREGA_CLIENTE" };
        } else if (s.status === "CREADO" || s.status === "RECIBIDO_EN_BODEGA") {
          const originFr = allFranchises?.find((f) => f.id === s.originFranchiseId);
          if (s.status === "CREADO" && !originFr?.isWarehouse) place = { label: "la tienda que lo creo" };
          else place = { label: `la seccion ${tabLabel("EN_BODEGA")}`, tab: "EN_BODEGA" };
        } else if (["ENVIADO_A_DESTINO", "EN_RUTA", "EN_PARADA"].includes(s.status)) {
          place = { label: `la seccion ${tabLabel("EN_RUTA")}`, tab: "EN_RUTA" };
        } else if (s.status === "RECIBIDO_EN_DESTINO" || s.status === "ENTREGADO_AL_CLIENTE") {
          place = { label: `la seccion ${tabLabel("ENTREGADOS")}`, tab: "ENTREGADOS" };
        } else if (s.status === "NO_RECOGIDO") {
          place = { label: "Rutas, en No recogidos", href: "/rutas?tab=NO_RECOGIDOS" };
        }
      }
      if (!place || place.tab === activeTab) continue;
      hits.push({ id: s.id, trackingNumber: s.trackingNumber, label: place.label, tab: place.tab, href: place.href });
      if (hits.length >= 4) break;
    }
    return hits;
  }, [searchQuery, filteredShipments, baseShipments, interBodegaEnRuta, originFilter, destFilter, stuckIds, isBodega, myFranchiseId, isReceivingWarehouse, interBodegaIds, allFranchises, activeTab, TABS]);

  // Count per tab
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tab of TABS) {
      counts[tab.key] = 0;
    }
    for (const s of baseShipments || []) {
      for (const tab of TABS) {
        if (!tab.statuses.includes(s.status)) continue;
        if (tab.key === "EN_RUTA" && stuckIds.has(s.id)) continue;

        // Store-specific counting with origin/dest logic
        if (!isBodega && myFranchiseId) {
          if (tab.key === "POR_ENVIAR" && s.originFranchiseId === myFranchiseId) {
            counts[tab.key]++;
          } else if (tab.key === "ENVIADOS" && s.originFranchiseId === myFranchiseId) {
            counts[tab.key]++;
          } else if (tab.key === "POR_RECIBIR" && s.destinationFranchiseId === myFranchiseId && s.originFranchiseId !== myFranchiseId) {
            counts[tab.key]++;
          } else if (tab.key === "EN_TIENDA" && s.destinationFranchiseId === myFranchiseId) {
            counts[tab.key]++;
          } else if (tab.key === "COMPLETADOS" && (s.originFranchiseId === myFranchiseId || (s.destinationFranchiseId === myFranchiseId && s.status === "ENTREGADO_AL_CLIENTE"))) {
            counts[tab.key]++;
          } else if (
            tab.key !== "POR_ENVIAR" &&
            tab.key !== "ENVIADOS" &&
            tab.key !== "POR_RECIBIR" &&
            tab.key !== "EN_TIENDA" &&
            tab.key !== "COMPLETADOS"
          ) {
            counts[tab.key]++;
          }
        } else {
          if (isBodega && !isReceivingWarehouse && tab.key === "EN_BODEGA") {
            const destName = (s.destinationName || "").toLowerCase();
            const isRouteDest = destName.includes("grecia") || destName.includes("palmares") || destName.includes("san ramon");
            // Route shipments in Cedi go to Routes page, hide from EN_BODEGA count
            if (isRouteDest && s.warehouseLocation === "Bodega Cedi") continue;
            if (s.destinationFranchiseId === myFranchiseId) continue; // dest is THIS bodega, goes to ENTREGA_CLIENTE
            const originFr = allFranchises?.find((f) => f.id === s.originFranchiseId);
            if (s.status === "CREADO" && !originFr?.isWarehouse) continue;
            counts[tab.key]++;
          } else if (isBodega && tab.key === "ENTREGA_CLIENTE") {
            if (s.destinationFranchiseId === myFranchiseId && s.status === "RECIBIDO_EN_BODEGA") {
              counts[tab.key]++;
            }
          } else {
            counts[tab.key]++;
          }
        }
        // No break here — RECIBIDO_EN_DESTINO can count for both EN_TIENDA and COMPLETADOS
      }
    }
    // Add inter-bodega in-transit count to EN_RUTA
    counts["EN_RUTA"] = (counts["EN_RUTA"] || 0) + interBodegaEnRuta.length;
    return counts;
  }, [baseShipments, interBodegaEnRuta, TABS, isBodega, myFranchiseId, allFranchises, stuckIds]);

  const renderShipmentCard = (shipment: (typeof filteredShipments)[0]) => {
    const cfg = getStatusConfig(shipment.status);
    const place = shipmentPlaceText(shipment);
    const stuck = Boolean(shipment.stuckAfterRoute);
    const selectable = canSelectShipment(shipment);
    const isSelected = actionableSelectedIds.includes(shipment.id);
    const checking = Boolean(checkMode) && selectable;
    const card = (
          <Card
            onClick={checking ? () => toggleSelection(shipment.id) : undefined}
            onKeyDown={checking ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleSelection(shipment.id);
              }
            } : undefined}
            role={checking ? "button" : undefined}
            tabIndex={checking ? 0 : undefined}
            className={`${checking ? "cursor-pointer" : ""} ${
              isSelected ? "bg-[#FFF5F5]" : "bg-white"
            } border-0 shadow-none rounded-none`}
          >
            <CardContent className={`p-4 ${checking ? "pl-10" : ""}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-semibold font-mono text-[#C8102E] text-lg">{shipment.trackingNumber}</p>
                    {cfg && (
                      <Badge variant="secondary" className={stuck ? "bg-red-50 text-red-700" : cfg.color}>
                        <cfg.icon className="w-3 h-3 mr-1" />
                        {place.badge || cfg.label}
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
                  <div className="flex items-center gap-2 mt-1 text-sm text-[#525252]">
                    <span>{shipment.originName}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#D4D4D4]" />
                    <span className={shipment.destinationName?.toLowerCase().includes("recogida") ? "font-medium text-orange-700" : ""}>
                      {shipment.destinationName}
                    </span>
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
                  {place.chip && (
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                      {place.chip}
                    </span>
                  )}
                  {!selectable && !isBodega && activeTab === "POR_RECIBIR" && (
                    <p className="text-[11px] leading-snug text-amber-700 font-medium max-w-[200px] ml-auto">
                      {shipment.status === "RECIBIDO_EN_BODEGA"
                        ? "Sigue en bodega. Se recibe cuando ya va hacia la tienda."
                        : "Todavia va hacia la bodega. Se recibe cuando ya va hacia la tienda."}
                    </p>
                  )}
                  {isBodega && activeTab === "POR_RECIBIR" && shipment.status === "ENVIADO_A_BODEGA" && (() => {
                    const firstStop = getFranchiseGroup(shipment.originName) === "vendedor" ? "Bodega Cedi" : "Bodega Pavon";
                    if (!shipment.warehouseLocation || shipment.warehouseLocation === firstStop) return null;
                    return firstStop;
                  })() && (
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      Viene de {getFranchiseGroup(shipment.originName) === "vendedor" ? "Bodega Cedi" : "Bodega Pavon"}
                    </span>
                  )}
                  <div className="flex justify-end gap-3 mt-1">
                    {checking && (
                      <Link
                        to={`/envios/${shipment.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center text-xs text-[#525252] hover:text-[#1A1A1A] hover:underline font-medium"
                      >
                        Ver
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(`/boleta/${shipment.id}`, "_blank");
                      }}
                      className="inline-flex items-center gap-1 text-xs text-[#C8102E] hover:text-[#9B0B22] hover:underline font-medium"
                    >
                      <Printer className="w-3 h-3" />
                      Boleta
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
    );
    return (
      <div id={`envio-${shipment.id}`} key={shipment.id} className="relative group">
        {checking && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10" onClick={(event) => event.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleSelection(shipment.id)}
              className="border-[#D4D4D4] data-[state=checked]:bg-[#C8102E] data-[state=checked]:border-[#C8102E]"
            />
          </div>
        )}
        {checking ? card : (
          <Link to={`/envios/${shipment.id}`} className="block">
            {card}
          </Link>
        )}
      </div>
    );
  };

  const hasFilters = searchQuery !== "" || originFilter.length > 0 || destFilter.length > 0;

  const clearFilters = () => {
    setSearchQuery("");
    setOriginFilter([]);
    setDestFilter([]);
  };

  const canSelectShipment = (shipment: { status: string; destinationFranchiseId?: number }) => {
    if (checkMode === "entrega") {
      return shipment.status === "RECIBIDO_EN_DESTINO" && shipment.destinationFranchiseId === myFranchiseId;
    }
    if (checkMode === "recepcion") {
      if (isBodega && !isReceivingWarehouse) return shipment.status === "ENVIADO_A_BODEGA";
      return shipment.status === "ENVIADO_A_DESTINO";
    }
    if (checkMode === "salida") {
      if (isBodega) return shipment.status === "CREADO" || shipment.status === "RECIBIDO_EN_BODEGA";
      return shipment.status === "CREADO";
    }
    return false;
  };

  const shipmentPool = useMemo(() => {
    const pool = new Map<number, { id: number; status: string; destinationFranchiseId: number; originFranchiseId: number }>();
    for (const shipment of baseShipments || []) pool.set(shipment.id, shipment);
    for (const shipment of interBodegaEnRuta) pool.set(shipment.id, shipment);
    return pool;
  }, [baseShipments, interBodegaEnRuta]);

  // Marks that still belong to a package this tab can act on. Ghost marks from
  // packages that already moved on must not show "Confirmar" or hit the API.
  const actionableSelectedIds = selectedIds.filter((id) => {
    const shipment = shipmentPool.get(id);
    return Boolean(shipment && canSelectShipment(shipment));
  });

  useEffect(() => {
    if (!markTab || !checkMode || listQuery.isLoading || marksQuery.isLoading) return;
    if (baseShipments === undefined) return;
    const stale = selectedIds.filter((id) => !actionableSelectedIds.includes(id));
    if (stale.length === 0) return;
    removeMarks.mutate({ tab: markTab, ids: stale });
  }, [
    markTab,
    checkMode,
    listQuery.isLoading,
    marksQuery.isLoading,
    baseShipments,
    selectedIds,
    actionableSelectedIds,
  ]);

  const toggleSelection = (id: number) => {
    if (!markTab || !checkMode) return;
    if (selectedIds.includes(id)) removeMarks.mutate({ tab: markTab, ids: [id] });
    else addMarks.mutate({ tab: markTab, ids: [id] });
  };

  const reviewKeyOf = (shipment: { destinationFranchiseId: number; originFranchiseId: number; senderName?: string | null }) =>
    checkMode === "entrega"
      ? `cliente:${(shipment.senderName || "sin nombre").trim().toLowerCase()}`
      : checkMode === "salida"
        ? `dest:${shipment.destinationFranchiseId}`
        : `origin:${shipment.originFranchiseId}`;

  const reviewGroups = !checkMode ? [] : (() => {
    const map = new Map<string, { key: string; label: string; count: number }>();
    for (const shipment of filteredShipments) {
      if (!canSelectShipment(shipment)) continue;
      const key = reviewKeyOf(shipment);
      const label = (checkMode === "entrega"
        ? shipment.senderName
        : checkMode === "salida"
          ? shipment.destinationName
          : shipment.originName) || "Sin nombre";
      const current = map.get(key);
      if (current) current.count += 1;
      else map.set(key, { key, label, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
  })();

  const activeReviewGroup = reviewGroups.some((group) => group.key === reviewGroup) ? reviewGroup : null;
  const visibleShipments = activeReviewGroup
    ? filteredShipments.filter((shipment) => reviewKeyOf(shipment) === activeReviewGroup)
    : filteredShipments;
  const scanPool = visibleShipments.filter(canSelectShipment);
  const stillAtWarehouse = !isBodega && checkMode === "recepcion"
    ? (baseShipments || []).filter((shipment) =>
        shipment.destinationFranchiseId === myFranchiseId &&
        shipment.originFranchiseId !== myFranchiseId &&
        (shipment.status === "ENVIADO_A_BODEGA" || shipment.status === "RECIBIDO_EN_BODEGA")
      )
    : [];

  const selectAllVisible = () => {
    const selectable = visibleShipments.filter(canSelectShipment);
    const allSelected = selectable.length > 0 && selectable.every((s) => actionableSelectedIds.includes(s.id));
    if (!markTab || !checkMode) return;
    if (allSelected) {
      removeMarks.mutate({ tab: markTab, ids: selectable.map((shipment) => shipment.id) });
    } else {
      const missing = selectable.map((shipment) => shipment.id).filter((id) => !actionableSelectedIds.includes(id));
      if (missing.length > 0) addMarks.mutate({ tab: markTab, ids: missing });
    }
  };

  const unmarkedWarning = () => {
    if (!checkMode) return "";
    const left = scanPool.filter((shipment) => !actionableSelectedIds.includes(shipment.id));
    if (left.length === 0) return " Todos los de la lista estan marcados.";
    const sample = left.slice(0, 6).map((shipment) => `${shipment.trackingNumber} (${shipment.senderName})`).join(", ");
    const extra = left.length > 6 ? ` y ${left.length - 6} mas` : "";
    return ` En la lista hay ${scanPool.length}. Sin marcar quedan ${left.length}: ${sample}${extra}. Esos no entran en este viaje.`;
  };

  const openConfirmDialog = (title: string, description: string, onConfirm: () => void, askName = false) => {
    confirmActionRef.current = onConfirm;
    receiverDraftRef.current = "";
    setReceiverDraft("");
    setConfirmDialog({ open: true, title, description, askName });
  };

  const closeConfirmDialog = () => {
    confirmActionRef.current = null;
    setReceiverDraft("");
    setConfirmDialog({ open: false, title: "", description: "", askName: false });
  };

  // ─── Action handlers ──────────────────────────────────────────

  const confirmarSalida = () => {
    if (actionableSelectedIds.length === 0) return;
    const seleccionados = actionableSelectedIds
      .map((id) => shipmentPool.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    const noCreados = seleccionados.filter((s) => s.status !== "CREADO");
    if (noCreados.length > 0) {
      notify("error", `${noCreados.length} envio(s) no estan en estado CREADO`);
      return;
    }
    openConfirmDialog(
      "Confirmar Salida a Bodega",
      `Confirmar la salida de ${actionableSelectedIds.length} envio(s).${unmarkedWarning()}`,
      () => confirmarSalidaMutation.mutate({ ids: actionableSelectedIds })
    );
  };

  const recibirEnBodega = () => {
    if (actionableSelectedIds.length === 0) return;
    const seleccionados = actionableSelectedIds
      .map((id) => shipmentPool.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    const invalidos = seleccionados.filter((s) => s.status !== "ENVIADO_A_BODEGA");
    if (invalidos.length > 0 || seleccionados.length !== actionableSelectedIds.length) {
      notify("error", `${Math.max(invalidos.length, actionableSelectedIds.length - seleccionados.length)} envio(s) no estan en estado ENVIADO_A_BODEGA`);
      return;
    }
    openConfirmDialog(
      "Confirmar Recepcion en Bodega",
      `Confirmar la recepcion de ${actionableSelectedIds.length} envio(s).${unmarkedWarning()}`,
      () => recibirBodegaMutation.mutate({ ids: actionableSelectedIds })
    );
  };

  const enviarADestino = () => {
    if (actionableSelectedIds.length === 0) return;
    const seleccionados = (baseShipments || []).filter((s) => actionableSelectedIds.includes(s.id));
        // SOLO en Bodega Pavon: bloquear si se mezclan envios propios con recolecciones de tiendas
    const isBodegaPavon = (user?.franchise?.displayName || "").toLowerCase().includes("pavon");
    if (isBodegaPavon) {
      const conOrigenBodega = seleccionados.filter((s) => {
        const originFr = allFranchises?.find((f) => f.id === s.originFranchiseId);
        return originFr?.isWarehouse === 1;
      });
      const conOrigenTienda = seleccionados.filter((s) => {
        const originFr = allFranchises?.find((f) => f.id === s.originFranchiseId);
        return !originFr || originFr?.isWarehouse !== 1;
      });

      if (conOrigenBodega.length > 0 && conOrigenTienda.length > 0) {
        notify("error", "No se puede procesar envios de bodega y recolecciones de tiendas juntos. Selecciona solo uno de los dos tipos.");
        return;
      }
    }
        // SOLO en Cedi: bloquear si se mezclan envios hacia grupo Mio (Pavon) con envios hacia grupo Vendedor/Sabana/Ruta (directo)
       const isBodegaCedi = (user?.franchise?.displayName || "").toLowerCase().includes("cedi");
    if (isBodegaCedi) {
      const vaAPavon = seleccionados.filter((s) => getFranchiseGroup(s.destinationName) === "mio");
      const vaDirecto = seleccionados.filter((s) => getFranchiseGroup(s.destinationName) !== "mio");

      if (vaAPavon.length > 0 && vaDirecto.length > 0) {
        notify("error", "No se puede procesar envios hacia tiendas Mio y tiendas Vendedor juntos. Selecciona solo uno de los dos grupos.");
        return;
      }
    }
    const invalidos = seleccionados.filter((s) => s.status !== "RECIBIDO_EN_BODEGA" && s.status !== "CREADO");
    if (invalidos.length > 0) {
      notify("error", `${invalidos.length} envio(s) no estan en estado valido para enviar`);
      return;
    }

    const mixedMove = mixedShipmentMoveMessage(seleccionados);
    if (mixedMove) {
      notify("error", mixedMove);
      return;
    }

    const interBodega = seleccionados.length > 0 ? needsInterBodega(seleccionados[0]) : { needsTransfer: false, targetBodega: "" };

    if (interBodega.needsTransfer) {
      openConfirmDialog(
        "Confirmar Envio a Otra Bodega",
        `Enviar ${actionableSelectedIds.length} envio(s) hacia ${interBodega.targetBodega}.${unmarkedWarning()}`,
        () => {
          pendingTargetRef.current = interBodega.targetBodega;
          setBulkMessage({
            tone: "ok",
            text: `Enviando ${actionableSelectedIds.length} envio(s) a ${interBodega.targetBodega}...`,
          });
          enviarInterBodegaMutation.mutate({ ids: actionableSelectedIds, targetBodega: interBodega.targetBodega });
        }
      );
    } else {
      openConfirmDialog(
        "Confirmar Envio a Destino",
        `Confirmar el envio a destino de ${actionableSelectedIds.length} envio(s).${unmarkedWarning()}`,
        () => enviarDestinoMutation.mutate({ ids: actionableSelectedIds })
      );
    }
  };

  const entregarAlCliente = () => {
    if (actionableSelectedIds.length === 0) return;
    const seleccionados = (baseShipments || []).filter((s) => actionableSelectedIds.includes(s.id));
    const invalidos = seleccionados.filter((s) => s.status !== "RECIBIDO_EN_BODEGA" || s.destinationFranchiseId !== myFranchiseId);
    if (invalidos.length > 0) {
      toast.error("Selecciona solo envios que el cliente retira en esta bodega");
      return;
    }
    openConfirmDialog(
      "Entregar al cliente",
      `El cliente ya retiró ${actionableSelectedIds.length} envio(s) en esta bodega.${unmarkedWarning()}`,
      () => entregarClienteMutation.mutate({ ids: actionableSelectedIds })
    );
  };

  const recibirEnDestino = () => {
    if (actionableSelectedIds.length === 0) return;
    const seleccionados = actionableSelectedIds
      .map((id) => shipmentPool.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    const invalidos = seleccionados.filter((s) => s.status !== "ENVIADO_A_DESTINO");
    if (invalidos.length > 0 || seleccionados.length !== actionableSelectedIds.length) {
      toast.error("Esos paquetes siguen en bodega. Solo se reciben cuando ya van hacia la tienda.");
      return;
    }
    openConfirmDialog(
      "Confirmar Recepcion en Tienda",
      `Confirmar la recepcion de ${actionableSelectedIds.length} envio(s) en tienda.${unmarkedWarning()}`,
      () => recibirDestinoMutation.mutate({ ids: actionableSelectedIds })
    );
  };

  const entregarEnTienda = () => {
    if (actionableSelectedIds.length === 0) return;
    const seleccionados = actionableSelectedIds
      .map((id) => shipmentPool.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    const invalidos = seleccionados.filter((s) => s.status !== "RECIBIDO_EN_DESTINO" || s.destinationFranchiseId !== myFranchiseId);
    if (invalidos.length > 0 || seleccionados.length !== actionableSelectedIds.length) {
      toast.error("Selecciona solo paquetes que ya estan en esta tienda");
      return;
    }
    openConfirmDialog(
      "Entregar al cliente",
      `El cliente retira ${actionableSelectedIds.length} paquete(s) de esta tienda. Escribe el nombre de quien los recibe.${unmarkedWarning()}`,
      () => {
        const name = receiverDraftRef.current.trim();
        if (name.length < 2) {
          toast.error("Escribe el nombre de quien retira");
          return;
        }
        entregarEnTiendaMutation.mutate({ ids: actionableSelectedIds, receiverName: name });
      },
      true,
    );
  };

  const primaryAction = (() => {
    if (actionableSelectedIds.length === 0) return null;
    const busy = (pending: boolean, label: string) => (pending ? "Procesando..." : label + " (" + actionableSelectedIds.length + ")");
    if (!isBodega && activeTab === "POR_ENVIAR") {
      return { label: busy(confirmarSalidaMutation.isPending, "Confirmar salida"), onClick: confirmarSalida, disabled: confirmarSalidaMutation.isPending };
    }
    if (!isBodega && activeTab === "EN_TIENDA") {
      return { label: busy(entregarEnTiendaMutation.isPending, "Entregar al cliente"), onClick: entregarEnTienda, disabled: entregarEnTiendaMutation.isPending };
    }
    if ((!isBodega || isReceivingWarehouse) && activeTab === "POR_RECIBIR") {
      return { label: busy(recibirDestinoMutation.isPending, "Confirmar recepcion"), onClick: recibirEnDestino, disabled: recibirDestinoMutation.isPending };
    }
    if (isBodega && !isReceivingWarehouse && activeTab === "POR_RECIBIR") {
      return { label: busy(recibirBodegaMutation.isPending, "Confirmar recepcion"), onClick: recibirEnBodega, disabled: recibirBodegaMutation.isPending };
    }
    if (isBodega && activeTab === "EN_BODEGA") {
      const selectedShipments = (baseShipments || []).filter((s) => actionableSelectedIds.includes(s.id));
      const interBodega = selectedShipments.length > 0 ? needsInterBodega(selectedShipments[0]) : { needsTransfer: false, targetBodega: "" };
      const hasInterBodega = selectedShipments.some((s) => needsInterBodega(s).needsTransfer);
      const mixedMove = mixedShipmentMoveMessage(selectedShipments);
      if (mixedMove) return { label: "", onClick: () => {}, disabled: true, note: mixedMove };
      if (hasInterBodega) {
        return {
          label: enviarInterBodegaMutation.isPending ? "Procesando..." : "Enviar a " + interBodega.targetBodega + " (" + actionableSelectedIds.length + ")",
          onClick: enviarADestino,
          disabled: enviarDestinoMutation.isPending || enviarInterBodegaMutation.isPending,
        };
      }
      return { label: busy(enviarDestinoMutation.isPending, "Enviar a destino"), onClick: enviarADestino, disabled: enviarDestinoMutation.isPending };
    }
    if (isBodega && activeTab === "ENTREGA_CLIENTE") {
      return { label: busy(entregarClienteMutation.isPending, "Entregado al cliente"), onClick: entregarAlCliente, disabled: entregarClienteMutation.isPending };
    }
    return null;
  })();

  // ─── Date filter visibility ───────────────────────────────────

  const showDateFilter = !isBodega && activeTab === "ENVIADOS";
  const historyKeys: string[] = isReceivingWarehouse
    ? []
    : isBodega
      ? ["EN_RUTA", "ENTREGADOS", "CANCELADOS"]
      : ["ENVIADOS", "COMPLETADOS", "CANCELADOS"];
  const workKeys: string[] = isReceivingWarehouse
    ? ["POR_RECIBIR", "EN_BODEGA", "CANCELADOS"]
    : isBodega
      ? ["POR_RECIBIR", "EN_BODEGA", "ENTREGA_CLIENTE"]
      : ["POR_ENVIAR", "POR_RECIBIR", "EN_TIENDA"];
  const stationLabel = (key: string) => {
    if (key === "POR_ENVIAR") return "Enviar";
    if (key === "POR_RECIBIR") return "Recibir";
    if (key === "EN_TIENDA" || key === "ENTREGA_CLIENTE") return "Cliente";
    if (key === "EN_BODEGA") return "En bodega";
    if (key === "CANCELADOS") return "Cancelados";
    if (key === "ENVIADOS") return "En camino";
    if (key === "COMPLETADOS" || key === "ENTREGADOS") return "Entregados";
    if (key === "EN_RUTA") return "En ruta";
    return key;
  };
  const historyOpen = historyKeys.includes(activeTab);

  return (
    <FranchiseLayout>
      <div className={`space-y-6 ${primaryAction?.label ? "pb-24" : ""}`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A1A]">
              {historyOpen ? "Historial" : stationLabel(activeTab)}
            </h1>
            <p className="text-sm text-[#8A8A8A] mt-1">{currentTab.description}</p>
            <p className="text-xs text-[#A3A3A3] mt-1">
              {visibleShipments.length} paquete{visibleShipments.length !== 1 ? "s" : ""}
              {actionableSelectedIds.length > 0 && (
                <span className="text-[#C8102E]">
                  {" "}· {actionableSelectedIds.length} marcado{actionableSelectedIds.length !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!isBodega && activeTab === "POR_ENVIAR" && (
              <Link
                to="/enviar"
                className="inline-flex items-center justify-center px-4 py-2.5 bg-[#C8102E] text-white rounded-lg text-sm font-medium hover:bg-[#9B0B22] transition-colors"
              >
                <Package className="w-4 h-4 mr-2" />
                Nuevo envio
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowTrips((open) => !open)}
              className="inline-flex items-center justify-center px-4 py-2.5 border border-[#D4D4D4] bg-white text-[#1A1A1A] rounded-lg text-sm font-medium hover:bg-[#F7F7F7]"
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Bitacoras
            </button>
          </div>
        </div>

        {showTrips && (
          <div className="rounded-xl border border-[#D4D4D4] bg-white p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A]">Bitacoras guardadas</p>
              <p className="text-xs text-[#8A8A8A] mt-0.5">Si se olvido imprimir, abra el viaje. No hay que marcar los paquetes otra vez.</p>
            </div>
            {tripsQuery.isLoading ? (
              <p className="text-sm text-[#8A8A8A]">Cargando...</p>
            ) : (tripsQuery.data || []).length === 0 ? (
              <p className="text-sm text-[#8A8A8A]">Todavia no hay un envio o una recepcion confirmada.</p>
            ) : (
              <div className="space-y-2">
                {(tripsQuery.data || []).map((trip) => {
                  const trackingHint = trip.sampleTracking
                    ? `${trip.sampleTracking}${trip.extraTracking > 0 ? ` +${trip.extraTracking} mas` : ""}`
                    : "";
                  return (
                  <div key={trip.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-[#F0F0F0] rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1A1A1A]">{trip.label}</p>
                      {(trip.routeSummary || trackingHint) && (
                        <p className="text-xs text-[#525252] mt-0.5 truncate">
                          {trip.routeSummary}
                          {trip.routeSummary && trackingHint ? " · " : ""}
                          {trackingHint && <span className="font-mono">{trackingHint}</span>}
                        </p>
                      )}
                      <p className="text-xs text-[#8A8A8A] mt-0.5">
                        {format(new Date(trip.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                        {" · "}
                        {trip.packageCount} paquete{trip.packageCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const ids = trip.shipmentIds.split(",").map((id) => Number(id)).filter(Boolean).join(",");
                        if (ids) window.open(`/bitacora?ids=${ids}`, "_blank");
                      }}
                      className="inline-flex items-center justify-center h-10 px-3 rounded-lg bg-[#C8102E] text-white text-sm font-medium shrink-0"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimir
                    </button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {bulkMessage && (
          <div
            className={`px-4 py-3 rounded-lg border text-sm font-medium ${
              bulkMessage.tone === "error"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            {bulkMessage.text}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto border-b border-[#E5E5E5]">
          {workKeys.map((key) => {
            const count = tabCounts[key] || 0;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleTabChange(key as ActiveTabKey)}
                className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
                  isActive ? "border-[#C8102E] text-[#1A1A1A]" : "border-transparent text-[#8A8A8A] hover:text-[#1A1A1A]"
                }`}
              >
                {stationLabel(key)}
                <span className={`ml-2 text-xs font-semibold ${isActive ? "text-[#C8102E]" : "text-[#A3A3A3]"}`}>{count}</span>
              </button>
            );
          })}
          {historyKeys.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const next = historyPick && historyKeys.includes(historyPick) ? historyPick : historyKeys[0];
                handleTabChange(next as ActiveTabKey);
              }}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
                historyOpen ? "border-[#C8102E] text-[#1A1A1A]" : "border-transparent text-[#8A8A8A] hover:text-[#1A1A1A]"
              }`}
            >
              Historial
            </button>
          )}
        </div>

        {historyOpen && (
          <div className="flex gap-2 overflow-x-auto">
            {historyKeys.map((key) => {
              const on = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setHistoryPick(key);
                    handleTabChange(key as ActiveTabKey);
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
                    on ? "bg-[#1A1A1A] text-white border-[#1A1A1A]" : "bg-white text-[#525252] border-[#D4D4D4]"
                  }`}
                >
                  {stationLabel(key)} · {tabCounts[key] || 0}
                </button>
              );
            })}
          </div>
        )}

        {checkMode && visibleShipments.length > 0 && (
          <ShipmentCheckBar
            mode={checkMode}
            groups={reviewGroups}
            activeGroup={activeReviewGroup}
            onGroup={setReviewGroup}
            shipments={scanPool}
            waitingShipments={stillAtWarehouse.length > 0 ? stillAtWarehouse : visibleShipments.filter((shipment) => !canSelectShipment(shipment))}
            selectedIds={actionableSelectedIds}
            onMark={(id) => {
              if (markTab && !actionableSelectedIds.includes(id)) addMarks.mutate({ tab: markTab, ids: [id] });
              requestAnimationFrame(() => {
                document.getElementById(`envio-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
              });
            }}
            onPrint={() => {
              if (actionableSelectedIds.length === 0) {
                toast.error("Escanea los paquetes primero. Esos son los que se imprimen.");
                return;
              }
              window.open(`/bitacora?ids=${actionableSelectedIds.join(",")}`, "_blank");
            }}
          />
        )}

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
            {dateFilterEnabled && (
              <span className="text-sm text-[#8A8A8A]">
                {format(parseISO(dateFilter), "dd/MM/yyyy", { locale: es })}
              </span>
            )}
          </div>
        )}

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
              {/* Multi-select origin dropdown */}
              <div className="relative flex-1" ref={originDropdownRef}>
                <button
                  onClick={() => setOriginDropdownOpen(!originDropdownOpen)}
                  className="w-full h-11 px-3 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E] text-[#1A1A1A] bg-white flex items-center justify-between"
                >
                  <span className="truncate">
                    {originFilter.length === 0
                      ? "Todas las tiendas (origen)"
                      : originFilter.length === 1
                        ? cleanName(originFranchisesForFilter.find((f) => f.id.toString() === originFilter[0])?.displayName)
                        : `${originFilter.length} tiendas seleccionadas`}
                  </span>
                  <ChevronDown className="w-4 h-4 text-[#8A8A8A] shrink-0 ml-2" />
                </button>
                {originDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-[#D4D4D4] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div
                      className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-[#F9F9F9] border-b border-[#F0F0F0]"
                      onClick={() => setOriginFilter([])}
                    >
                      <Checkbox
                        checked={originFilter.length === 0}
                        onCheckedChange={() => setOriginFilter([])}
                      />
                      <span className="text-sm text-[#1A1A1A]">Todas las tiendas (origen)</span>
                    </div>
                    {originFranchisesForFilter.map((f) => (
                      <div
                        key={f.id}
                        className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-[#F9F9F9]"
                        onClick={() => {
                          const id = f.id.toString();
                          setOriginFilter((prev) =>
                            prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
                          );
                        }}
                      >
                        <Checkbox
                          checked={originFilter.includes(f.id.toString())}
                          onCheckedChange={() => {
                            const id = f.id.toString();
                            setOriginFilter((prev) =>
                              prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
                            );
                          }}
                        />
                        <span className="text-sm text-[#1A1A1A]">{cleanName(f.displayName)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {!isReceivingWarehouse && (
            <div className="flex gap-2">
              {/* Multi-select destination dropdown */}
              <div className="relative flex-1" ref={destDropdownRef}>
                <button
                  onClick={() => setDestDropdownOpen(!destDropdownOpen)}
                  className="w-full h-11 px-3 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E] text-[#1A1A1A] bg-white flex items-center justify-between"
                >
                  <span className="truncate">
                    {destFilter.length === 0
                      ? "Todos los destinos"
                      : destFilter.length === 1
                        ? cleanName(destinationFranchisesForFilter.find((f) => f.id.toString() === destFilter[0])?.displayName)
                        : `${destFilter.length} destinos seleccionados`}
                  </span>
                  <ChevronDown className="w-4 h-4 text-[#8A8A8A] shrink-0 ml-2" />
                </button>
                {destDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-[#D4D4D4] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div
                      className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-[#F9F9F9] border-b border-[#F0F0F0]"
                      onClick={() => setDestFilter([])}
                    >
                      <Checkbox
                        checked={destFilter.length === 0}
                        onCheckedChange={() => setDestFilter([])}
                      />
                      <span className="text-sm text-[#1A1A1A]">Todos los destinos</span>
                    </div>
                    {destinationFranchisesForFilter.map((f) => (
                      <div
                        key={f.id}
                        className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-[#F9F9F9]"
                        onClick={() => {
                          const id = f.id.toString();
                          setDestFilter((prev) =>
                            prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
                          );
                        }}
                      >
                        <Checkbox
                          checked={destFilter.includes(f.id.toString())}
                          onCheckedChange={() => {
                            const id = f.id.toString();
                            setDestFilter((prev) =>
                              prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
                            );
                          }}
                        />
                        <span className="text-sm text-[#1A1A1A]">{cleanName(f.displayName)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

        {isBodega && activeTab === "EN_RUTA" && stuckOnList.length > 0 && (
          <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">
                {stuckOnList.length === 1
                  ? "1 paquete quedo en una ruta cerrada."
                  : `${stuckOnList.length} paquetes quedaron en una ruta cerrada.`}
              </p>
              <Link to="/rutas" className="font-semibold underline">
                Corregir en Rutas
              </Link>
            </div>
          </div>
        )}

        {searchElsewhere.length > 0 && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 space-y-2">
            <p className="font-medium">
              {filteredShipments.length === 0 ? "No esta en esta seccion." : "Tambien hay envios en otra seccion."}
            </p>
            {searchElsewhere.map((hit) => (
              <div key={hit.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono font-semibold">{hit.trackingNumber}</span>
                <span>esta en {hit.label}.</span>
                {hit.tab && (
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => handleTabChange(hit.tab as ActiveTabKey)}
                  >
                    Abrir
                  </button>
                )}
                {hit.href && (
                  <Link to={hit.href} className="font-semibold underline">
                    Abrir Rutas
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}

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
          <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden divide-y divide-[#F0F0F0]">
            {/* Select all */}
            {checkMode && scanPool.length > 1 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-[#F7F7F7] rounded-lg border border-[#D4D4D4]">
                <Checkbox
                  checked={scanPool.every((s) => actionableSelectedIds.includes(s.id))}
                  onCheckedChange={selectAllVisible}
                  className="border-[#D4D4D4] data-[state=checked]:bg-[#C8102E] data-[state=checked]:border-[#C8102E]"
                />
                <span className="text-sm text-[#525252] font-medium">Marcar todos</span>
                <span className="text-xs text-[#A3A3A3] ml-1">({scanPool.length})</span>
              </div>
            )}
            {visibleShipments.map((s) => renderShipmentCard(s))}
          </div>
        )}

        {primaryAction?.note && (
          <p className="text-sm text-orange-700">{primaryAction.note}</p>
        )}
        {primaryAction && primaryAction.label && (
          <div className="fixed bottom-0 right-0 left-0 lg:left-64 z-30 border-t border-[#E5E5E5] bg-white p-3">
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="w-full h-12 rounded-xl bg-[#1A1A1A] text-white text-sm font-semibold disabled:opacity-60"
            >
              {primaryAction.label}
            </button>
          </div>
        )}

        {/* ─── Confirmation Dialog ─────────────────────────────── */}
        <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && closeConfirmDialog()}>
          <DialogContent
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{confirmDialog.title}</DialogTitle>
              <DialogDescription className="whitespace-pre-line">{confirmDialog.description}</DialogDescription>
            </DialogHeader>
            {confirmDialog.askName && (
              <input
                value={receiverDraft}
                onChange={(event) => {
                  receiverDraftRef.current = event.target.value;
                  setReceiverDraft(event.target.value);
                }}
                placeholder="Nombre de quien retira"
                className="h-11 w-full px-3 text-sm border border-[#D4D4D4] rounded-lg"
              />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeConfirmDialog}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-[#C8102E] hover:bg-[#9B0B22] text-white"
                onClick={() => {
                  if (confirmDialog.askName && receiverDraftRef.current.trim().length < 2) {
                    toast.error("Escribe el nombre de quien retira");
                    return;
                  }
                  const action = confirmActionRef.current;
                  action?.();
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
