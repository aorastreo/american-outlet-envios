import { useMemo } from "react";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  CheckCircle,
  Truck,
  ClipboardCheck,
  ArrowRight,
  Barcode,
  User,
  Store,
  AlertTriangle,
  Star,
  Send,
  Inbox,
  Route,
} from "lucide-react";
import { Link } from "react-router";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { shipmentPlaceText } from "@/lib/franchise-groups";

function getStatusConfig(status: string) {
  const configs: Record<string, { color: string; label: string; bg: string }> = {
    CREADO: { color: "text-slate-700", label: "Creado", bg: "bg-slate-100" },
    ENVIADO_A_BODEGA: { color: "text-amber-700", label: "Enviado a Bodega", bg: "bg-amber-50" },
    RECIBIDO_EN_BODEGA: { color: "text-purple-700", label: "En Bodega", bg: "bg-purple-50" },
    EN_RUTA: { color: "text-blue-700", label: "En Ruta", bg: "bg-blue-50" },
    EN_PARADA: { color: "text-orange-700", label: "En Parada", bg: "bg-orange-50" },
    ENVIADO_A_DESTINO: { color: "text-[#C8102E]", label: "Enviado a Destino", bg: "bg-[#FFF5F5]" },
    RECIBIDO_EN_DESTINO: { color: "text-emerald-700", label: "En tienda", bg: "bg-emerald-50" },
    ENTREGADO_AL_CLIENTE: { color: "text-emerald-700", label: "Entregado al cliente", bg: "bg-emerald-50" },
    NO_RECOGIDO: { color: "text-red-700", label: "No recogido", bg: "bg-red-50" },
    CANCELADO: { color: "text-red-700", label: "Cancelado", bg: "bg-red-50" },
  };
  return configs[status] || { color: "text-gray-700", label: status, bg: "bg-gray-100" };
}

function isRouteDestinationName(name?: string | null) {
  const n = (name || "").toLowerCase();
  return n.includes("grecia") || n.includes("palmares") || n.includes("san ramon");
}

function cleanName(name: string | undefined): string {
  if (!name) return "";
  const upper = name.toUpperCase();
  if (upper.includes("GANGA")) return "Ganga Santa Rosa";
  return name.replace(/AMERICAN OUTLET\s*/i, "").trim() || name;
}

function ShipmentCard({ shipment }: { shipment: any }) {
  const cfg = getStatusConfig(shipment.status);
  const place = shipmentPlaceText(shipment);
  const stuck = Boolean(shipment.stuckAfterRoute);
  return (
    <Link to={`/envios/${shipment.id}`} key={shipment.id}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer border-[#F0F0F0] hover:border-[#C8102E]/20">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-[#C8102E]" />
                  <p className="font-semibold font-mono text-[#C8102E] text-lg">
                    {shipment.trackingNumber}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${stuck ? "bg-red-50 text-red-700" : `${cfg.bg} ${cfg.color}`}`}>
                  {place.badge || cfg.label}
                </span>
                {place.chip && (
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                    {place.chip}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-[#8A8A8A]">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {shipment.senderName}
                </span>
                {shipment.invoiceNumber && (
                  <span className="text-[#A3A3A3]">| Fact: #{shipment.invoiceNumber}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-[#525252]">
                <span>{cleanName(shipment.originName)}</span>
                <span className="text-[#D4D4D4]">→</span>
                <span>{cleanName(shipment.destinationName)}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-[#A3A3A3]">
                {shipment.createdAt
                  ? format(new Date(shipment.createdAt), "dd/MM/yyyy HH:mm", { locale: es })
                  : "-"}
              </p>
              <p className="text-xs text-[#8A8A8A] mt-1">
                {cleanName(shipment.currentLocationName)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SectionHeader({
  title,
  count,
}: {
  icon?: unknown;
  title: string;
  count: number;
  iconColor?: string;
  badgeColor?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-3">
      <h2 className="text-base font-semibold text-[#1A1A1A]">{title}</h2>
      <span className="text-xs text-[#8A8A8A]">{count}</span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useFranchiseAuth();
  const { data: shipments, isLoading: shipmentsLoading } = trpc.shipment.list.useQuery();
  const { data: sentShipments } = trpc.shipment.listSent.useQuery(undefined, {
    enabled: user?.franchise?.isWarehouse === 1 && user?.username !== "bodega_sabana",
  });
  const isCediWarehouse = `${user?.franchise?.name || ""} ${user?.franchise?.displayName || ""} ${user?.username || ""}`.toLowerCase().includes("cedi");
  const { data: routePickupShipments } = trpc.route.getRouteShipments.useQuery(undefined, {
    enabled: isCediWarehouse,
  });

  const isWarehouse = user?.franchise?.isWarehouse === 1;
  const isReceivingWarehouse = user?.username === "bodega_sabana";
  const isBodega = isWarehouse || isReceivingWarehouse;
  const myFranchiseId = user?.franchiseId || 0;

  // WAREHOUSE FILTERS (main bodega)
  const warehousePendingReception = useMemo(() => {
    if (!isBodega || !shipments) return [];
    return shipments.filter((s) => s.status === "ENVIADO_A_BODEGA");
  }, [shipments, isBodega]);

  const warehouseInWarehouse = useMemo(() => {
    if (!isBodega || isReceivingWarehouse || !shipments) return [];
    return shipments.filter((s) => {
      if (s.destinationFranchiseId === myFranchiseId && s.status === "RECIBIDO_EN_BODEGA") return false;
      if (isRouteDestinationName(s.destinationName) && s.warehouseLocation === "Bodega Cedi") return false;
      if (s.status === "RECIBIDO_EN_BODEGA") return true;
      return s.status === "CREADO" && (s.originName || "").toLowerCase().includes("bodega");
    });
  }, [shipments, isBodega, isReceivingWarehouse, myFranchiseId]);

  const waitingForTruck = useMemo(() => {
    if (!isBodega || isReceivingWarehouse || !shipments) return [];
    return shipments.filter((s) => {
      if (!isRouteDestinationName(s.destinationName) || s.warehouseLocation !== "Bodega Cedi") return false;
      if (s.status === "RECIBIDO_EN_BODEGA" || s.status === "NO_RECOGIDO") return true;
      return s.status === "CREADO" && (s.originName || "").toLowerCase().includes("bodega");
    });
  }, [shipments, isBodega, isReceivingWarehouse]);
  const waitingToAssign = useMemo(
    () => waitingForTruck.filter((s) => !s.reservedOnRoute && s.status !== "NO_RECOGIDO"),
    [waitingForTruck],
  );
  const notCollectedAgain = useMemo(
    () => waitingForTruck.filter((s) => !s.reservedOnRoute && s.status === "NO_RECOGIDO"),
    [waitingForTruck],
  );
  const alreadyOnTruckRoute = useMemo(
    () => waitingForTruck.filter((s) => s.reservedOnRoute),
    [waitingForTruck],
  );

  const warehouseCustomerPickup = useMemo(() => {
    if (!isBodega || isReceivingWarehouse || !shipments) return [];
    return shipments.filter((s) => s.status === "RECIBIDO_EN_BODEGA" && s.destinationFranchiseId === myFranchiseId);
  }, [shipments, isBodega, isReceivingWarehouse, myFranchiseId]);

  const stuckHere = useMemo(() => {
    if (!isCediWarehouse || !shipments) return [];
    const stuckIds = new Set(
      (routePickupShipments || []).filter((s) => s.stuckAfterRoute).map((s) => s.id)
    );
    return shipments.filter((s) => stuckIds.has(s.id));
  }, [shipments, routePickupShipments, isCediWarehouse]);

  const warehouseInRoute = useMemo(() => {
    if (!isBodega || isReceivingWarehouse || !shipments) return [];
    const stuckIds = new Set(stuckHere.map((s) => s.id));
    const here = shipments.filter((s) =>
      ["EN_RUTA", "EN_PARADA", "ENVIADO_A_DESTINO"].includes(s.status) && !stuckIds.has(s.id)
    );
    const forwarded = (sentShipments || []).filter((s) => s.status === "ENVIADO_A_BODEGA" && !stuckIds.has(s.id));
    const seen = new Set(here.map((s) => s.id));
    return [...here, ...forwarded.filter((s) => !seen.has(s.id))];
  }, [shipments, sentShipments, stuckHere, isBodega, isReceivingWarehouse]);

  const warehouseDelivered = useMemo(() => {
    if (!isBodega || !shipments) return [];
    return shipments.filter((s) => s.status === "RECIBIDO_EN_DESTINO" || s.status === "ENTREGADO_AL_CLIENTE");
  }, [shipments, isBodega]);

  const cancelledShipments = useMemo(
    () => (shipments || []).filter((s) => s.status === "CANCELADO"),
    [shipments],
  );
  const sentToOtherBodega = useMemo(() => {
    if (!isBodega || isReceivingWarehouse) return [];
    const here = new Set((shipments || []).map((s) => s.id));
    return (sentShipments || []).filter((s) => s.status === "ENVIADO_A_BODEGA" && !here.has(s.id));
  }, [shipments, sentShipments, isBodega, isReceivingWarehouse]);
  const activeTotal = Math.max(0, (shipments?.length || 0) - cancelledShipments.length);
  const warehouseTotal = activeTotal + sentToOtherBodega.length;

  // RECEIVING WAREHOUSE FILTERS (Sabana — only receives)
  const receivingToReceive = useMemo(() => {
    if (!isReceivingWarehouse || !shipments) return [];
    return shipments.filter(
      (s) =>
        s.destinationFranchiseId === myFranchiseId &&
        s.status === "ENVIADO_A_DESTINO"
    );
  }, [shipments, isReceivingWarehouse, myFranchiseId]);

  const receivingReceived = useMemo(() => {
    if (!isReceivingWarehouse || !shipments) return [];
    return shipments.filter(
      (s) =>
        s.destinationFranchiseId === myFranchiseId &&
        s.status === "RECIBIDO_EN_DESTINO"
    );
  }, [shipments, isReceivingWarehouse, myFranchiseId]);

  // STORE FILTERS
  const storeCreated = useMemo(() => {
    if (isBodega || !shipments) return [];
    return shipments.filter(
      (s) => s.originFranchiseId === myFranchiseId && s.status === "CREADO"
    );
  }, [shipments, isBodega, myFranchiseId]);

  const storeToReceive = useMemo(() => {
    if (isBodega || !shipments) return [];
    return shipments.filter(
      (s) =>
        s.destinationFranchiseId === myFranchiseId &&
        s.originFranchiseId !== myFranchiseId &&
        s.status === "ENVIADO_A_DESTINO"
    );
  }, [shipments, isBodega, myFranchiseId]);

  const storeSent = useMemo(() => {
    if (isBodega || !shipments) return [];
    return shipments.filter(
      (s) =>
        s.originFranchiseId === myFranchiseId &&
        ["ENVIADO_A_BODEGA", "RECIBIDO_EN_BODEGA", "ENVIADO_A_DESTINO", "EN_RUTA", "EN_PARADA", "NO_RECOGIDO"].includes(s.status)
    );
  }, [shipments, isBodega, myFranchiseId]);

  const storeInStore = useMemo(() => {
    if (isBodega || !shipments) return [];
    return shipments.filter((s) => s.destinationFranchiseId === myFranchiseId && s.status === "RECIBIDO_EN_DESTINO");
  }, [shipments, isBodega, myFranchiseId]);

  const storeCompleted = useMemo(() => {
    if (isBodega || !shipments) return [];
    return shipments.filter((s) => {
      const sentByMe = s.originFranchiseId === myFranchiseId && (s.status === "RECIBIDO_EN_DESTINO" || s.status === "ENTREGADO_AL_CLIENTE");
      const handedHere = s.destinationFranchiseId === myFranchiseId && s.status === "ENTREGADO_AL_CLIENTE";
      return sentByMe || handedHere;
    });
  }, [shipments, isBodega, myFranchiseId]);

  // Stats for receiving warehouse (Sabana) — only 2 counters
  const receivingStats = [
    {
      label: "En Bodega",
      value: receivingReceived.length,
      icon: ClipboardCheck,
      color: "text-[#C8102E]",
      bg: "bg-[#FFF5F5]",
      border: "border-[#C8102E]/10",
      href: "/envios?tab=EN_BODEGA",
    },
    {
      label: "Por Recibir",
      value: receivingToReceive.length,
      icon: Inbox,
      color: "text-[#B8860B]",
      bg: "bg-amber-50",
      border: "border-amber-200/50",
      href: "/envios?tab=POR_RECIBIR",
    },
  ];

  const statCards = isReceivingWarehouse ? receivingStats : isBodega ? [
    { label: "Por Recibir", value: warehousePendingReception.length, href: "/envios?tab=POR_RECIBIR" },
    { label: "En Bodega", value: warehouseInWarehouse.length, href: "/envios?tab=EN_BODEGA" },
    { label: "Entrega a cliente", value: warehouseCustomerPickup.length, href: "/envios?tab=ENTREGA_CLIENTE" },
    ...(isCediWarehouse ? [{ label: "Para el camion", value: waitingForTruck.length, href: "/rutas" }] : []),
    ...(isCediWarehouse && stuckHere.length > 0 ? [{ label: "Por corregir", value: stuckHere.length, href: "/rutas" }] : []),
    { label: "En camino", value: warehouseInRoute.length, href: "/envios?tab=EN_RUTA" },
    { label: "Entregados", value: warehouseDelivered.length, href: "/envios?tab=ENTREGADOS" },
    { label: "Total", value: warehouseTotal },
  ] : [
    { label: "Por Enviar", value: storeCreated.length, href: "/envios?tab=POR_ENVIAR" },
    { label: "Enviados", value: storeSent.length, href: "/envios?tab=ENVIADOS" },
    { label: "Por Recibir", value: storeToReceive.length, href: "/envios?tab=POR_RECIBIR" },
    { label: "En Tienda", value: storeInStore.length, href: "/envios?tab=EN_TIENDA" },
    { label: "Completados", value: storeCompleted.length, href: "/envios?tab=COMPLETADOS" },
    { label: "Total", value: activeTotal },
  ];

  return (
    <FranchiseLayout>
      <div className="space-y-8">
        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">
            {cleanName(user?.franchise?.displayName || user?.franchise?.name) || "Franquicia"}
          </h1>
          <p className="text-[#8A8A8A] mt-1">
            {isReceivingWarehouse
              ? "Lo que llega y lo que ya se recibio"
              : isWarehouse
              ? "Lo que entra, lo que sale y lo que retira el cliente"
              : "Lo que hay que enviar, recibir y entregar"}
          </p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((stat) => {
            const urgent = stat.value > 0 && ["Por Enviar", "Por Recibir", "En Tienda", "En Bodega", "Entrega a cliente"].includes(stat.label);
            const body = (
              <div className="bg-white border border-[#E5E5E5] rounded-xl px-4 py-3 h-full">
                <p className={`text-2xl font-semibold tabular-nums ${urgent ? "text-[#C8102E]" : "text-[#1A1A1A]"}`}>{stat.value}</p>
                <p className="text-xs text-[#8A8A8A] mt-1">{stat.label}</p>
              </div>
            );
            return stat.href ? (
              <Link key={stat.label} to={stat.href} className="block hover:border-[#1A1A1A]">
                {body}
              </Link>
            ) : (
              <div key={stat.label}>{body}</div>
            );
          })}
        </div>

        {/* ==================== RECEIVING WAREHOUSE DASHBOARD (Sabana) ==================== */}
        {isReceivingWarehouse && (
          <>
            {/* TO RECEIVE - POR RECIBIR */}
            {receivingToReceive.length > 0 && (
              <div className="space-y-3">
                <SectionHeader
                  icon={Inbox}
                  title="Envios por Recibir"
                  count={receivingToReceive.length}
                  iconColor="text-[#B8860B]"
                  badgeColor="bg-amber-50 text-[#B8860B]"
                />
                <div className="space-y-3">
                  {receivingToReceive.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}

            {/* RECEIVED - RECIBIDOS */}
            {receivingReceived.length > 0 && (
              <div className="space-y-3">
                <SectionHeader
                  icon={CheckCircle}
                  title="Envios Recibidos"
                  count={receivingReceived.length}
                  iconColor="text-emerald-600"
                  badgeColor="bg-emerald-50 text-emerald-600"
                />
                <div className="space-y-3">
                  {receivingReceived.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== STORE DASHBOARD ==================== */}
        {!isBodega && (
          <>
            {/* CREATED - POR ENVIAR A BODEGA */}
            {storeCreated.length > 0 && (
              <div className="space-y-3">
                <SectionHeader
                  icon={Send}
                  title="Mis Envios por Enviar a Bodega"
                  count={storeCreated.length}
                  iconColor="text-[#C8102E]"
                  badgeColor="bg-[#FFF5F5] text-[#C8102E]"
                />
                <div className="space-y-3">
                  {storeCreated.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}

            {storeSent.length > 0 && (
              <div className="space-y-3">
                <SectionHeader
                  icon={Truck}
                  title="Enviados"
                  count={storeSent.length}
                  iconColor="text-[#D4730E]"
                  badgeColor="bg-orange-50 text-[#D4730E]"
                />
                <div className="space-y-3">
                  {storeSent.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}

            {storeToReceive.length > 0 && (
              <div className="space-y-3">
                <SectionHeader
                  icon={Inbox}
                  title="Envios por Recibir"
                  count={storeToReceive.length}
                  iconColor="text-[#B8860B]"
                  badgeColor="bg-amber-50 text-[#B8860B]"
                />
                <div className="space-y-3">
                  {storeToReceive.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}

            {storeInStore.length > 0 && (
              <div className="space-y-3">
                <SectionHeader
                  icon={Store}
                  title="En Tienda"
                  count={storeInStore.length}
                  iconColor="text-[#1B6B3E]"
                  badgeColor="bg-emerald-50 text-[#1B6B3E]"
                />
                <div className="space-y-3">
                  {storeInStore.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}

            {storeCompleted.length > 0 && (
              <div className="space-y-3">
                <SectionHeader
                  icon={CheckCircle}
                  title="Completados"
                  count={storeCompleted.length}
                  iconColor="text-blue-700"
                  badgeColor="bg-blue-50 text-blue-700"
                />
                <div className="space-y-3">
                  {storeCompleted.slice(0, 10).map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== WAREHOUSE DASHBOARD ==================== */}
        {isWarehouse && !isReceivingWarehouse && (
          <>
            {/* PENDING RECEPTION - POR RECIBIR DE TIENDAS */}
            {warehousePendingReception.length > 0 && (
              <div className="space-y-3">
                <SectionHeader
                  icon={AlertTriangle}
                  title="Envios por Recibir de Tiendas"
                  count={warehousePendingReception.length}
                  iconColor="text-[#B8860B]"
                  badgeColor="bg-amber-50 text-[#B8860B]"
                />
                <div className="space-y-3">
                  {warehousePendingReception.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}

            {/* IN WAREHOUSE - LISTOS PARA ENVIAR */}
            {warehouseInWarehouse.length > 0 && (
              <div className="space-y-3">
                <SectionHeader
                  icon={ClipboardCheck}
                  title="En Bodega - Listos para Enviar"
                  count={warehouseInWarehouse.length}
                  iconColor="text-purple-600"
                  badgeColor="bg-purple-50 text-purple-600"
                />
                <div className="space-y-3">
                  {warehouseInWarehouse.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}

            {warehouseCustomerPickup.length > 0 && (
              <div className="space-y-3">
                <SectionHeader
                  icon={User}
                  title="Entrega a cliente"
                  count={warehouseCustomerPickup.length}
                  iconColor="text-teal-700"
                  badgeColor="bg-teal-50 text-teal-700"
                />
                <div className="space-y-3">
                  {warehouseCustomerPickup.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}

            {waitingToAssign.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionHeader
                    icon={Truck}
                    title="Falta asignarlos a una ruta"
                    count={waitingToAssign.length}
                    iconColor="text-[#B8860B]"
                    badgeColor="bg-amber-50 text-[#B8860B]"
                  />
                  <Link to="/rutas" className="text-sm font-semibold text-[#C8102E] hover:underline mb-4">
                    Abrir Rutas
                  </Link>
                </div>
                <div className="space-y-3">
                  {waitingToAssign.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}

            {notCollectedAgain.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionHeader
                    icon={AlertTriangle}
                    title="No recogidos, se pueden asignar de nuevo"
                    count={notCollectedAgain.length}
                    iconColor="text-red-600"
                    badgeColor="bg-red-50 text-red-700"
                  />
                  <Link to="/rutas?tab=NO_RECOGIDOS" className="text-sm font-semibold text-[#C8102E] hover:underline mb-4">
                    Abrir Rutas
                  </Link>
                </div>
                <div className="space-y-3">
                  {notCollectedAgain.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}

            {alreadyOnTruckRoute.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionHeader
                    icon={Route}
                    title="Ya estan en una ruta"
                    count={alreadyOnTruckRoute.length}
                    iconColor="text-blue-600"
                    badgeColor="bg-blue-50 text-blue-600"
                  />
                  <Link to="/rutas" className="text-sm font-semibold text-[#C8102E] hover:underline mb-4">
                    Abrir Rutas
                  </Link>
                </div>
                <div className="space-y-3">
                  {alreadyOnTruckRoute.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}

            {stuckHere.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionHeader
                    icon={AlertTriangle}
                    title="Quedaron en una ruta cerrada"
                    count={stuckHere.length}
                    iconColor="text-red-600"
                    badgeColor="bg-red-50 text-red-700"
                  />
                  <Link to="/rutas" className="text-sm font-semibold text-[#C8102E] hover:underline mb-4">
                    Corregir en Rutas
                  </Link>
                </div>
                <div className="space-y-3">
                  {stuckHere.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}

            {/* IN ROUTE - YA SALIERON DE BODEGA */}
            {warehouseInRoute.length > 0 && (
              <div className="space-y-3">
                <SectionHeader
                  icon={Route}
                  title="Ya salieron de bodega"
                  count={warehouseInRoute.length}
                  iconColor="text-blue-600"
                  badgeColor="bg-blue-50 text-blue-600"
                />
                <div className="space-y-3">
                  {warehouseInRoute.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}

            {/* DELIVERED - ENTREGADOS */}
            {warehouseDelivered.length > 0 && (
              <div className="space-y-3">
                <SectionHeader
                  icon={CheckCircle}
                  title="Envios Entregados"
                  count={warehouseDelivered.length}
                  iconColor="text-emerald-600"
                  badgeColor="bg-emerald-50 text-emerald-600"
                />
                <div className="space-y-3">
                  {warehouseDelivered.slice(0, 10).map((s) => (
                    <ShipmentCard key={s.id} shipment={s} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {cancelledShipments.length > 0 && (
          <div className="space-y-3">
            <SectionHeader
              icon={AlertTriangle}
              title="Cancelados"
              count={cancelledShipments.length}
              iconColor="text-red-600"
              badgeColor="bg-red-50 text-red-700"
            />
            <div className="space-y-3">
              {cancelledShipments.slice(0, 10).map((s) => (
                <ShipmentCard key={s.id} shipment={s} />
              ))}
            </div>
          </div>
        )}

        {/* QUICK ACTIONS */}
        <div className={`grid grid-cols-1 ${isReceivingWarehouse ? "" : "md:grid-cols-2"} gap-4`}>
          {!isReceivingWarehouse && (
            <Link to="/enviar">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-[#C8102E]/20 bg-[#FFF5F5]/50 hover:border-[#C8102E]/40">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#C8102E] rounded-xl flex items-center justify-center">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#1A1A1A]">Crear Nuevo Envio</h3>
                    <p className="text-sm text-[#8A8A8A]">Agregar articulos y enviar a otra franquicia</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#C8102E]" />
                </CardContent>
              </Card>
            </Link>
          )}
          <Link to="/rastrear">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-[#D4D4D4] hover:border-[#C8102E]/30">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-[#1A1A1A] rounded-xl flex items-center justify-center">
                  <Star className="w-6 h-6 text-white fill-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[#1A1A1A]">Rastrear Envio</h3>
                  <p className="text-sm text-[#8A8A8A]">Buscar envio por numero de rastreo</p>
                </div>
                <ArrowRight className="w-5 h-5 text-[#C8102E]" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* EMPTY STATE */}
        {!shipmentsLoading &&
          (!shipments || shipments.length === 0) && (
            <Card className="border-[#D4D4D4]">
              <CardContent className="p-12 text-center">
                <Package className="w-12 h-12 text-[#D4D4D4] mx-auto mb-3" />
                <p className="text-[#8A8A8A]">No hay envios registrados</p>
                {!isReceivingWarehouse && (
                  <Link
                    to="/enviar"
                    className="text-[#C8102E] text-sm mt-2 inline-block hover:underline"
                  >
                    Crear primer envio
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
      </div>
    </FranchiseLayout>
  );
}
