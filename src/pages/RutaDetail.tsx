import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Truck, MapPin, Phone, Package, CheckCircle, XCircle, Play, ArrowLeft,
  ChevronRight, AlertCircle, Clock, User, Calendar, ArrowUpRight, MessageCircle,
  AlertTriangle, Search, ClipboardList, ArrowUp, ArrowDown,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const routeStatusConfig: Record<string, { color: string; label: string }> = {
  PLANIFICADA: { color: "bg-blue-50 text-blue-700", label: "Planificada" },
  EN_RUTA: { color: "bg-amber-50 text-[#B8860B]", label: "En Ruta" },
  COMPLETADA: { color: "bg-emerald-50 text-[#1B6B3E]", label: "Completada" },
  CANCELADA: { color: "bg-red-50 text-red-700", label: "Cancelada" },
};

const stopStatusConfig: Record<string, { color: string; label: string }> = {
  PENDIENTE: { color: "bg-slate-100 text-[#404040]", label: "Pendiente" },
  LLEGADO: { color: "bg-amber-50 text-[#B8860B]", label: "Llegado" },
  COMPLETADO: { color: "bg-emerald-50 text-[#1B6B3E]", label: "Completado" },
};

const shipmentStatusConfig: Record<string, { color: string; label: string }> = {
  ASIGNADO: { color: "bg-blue-50 text-blue-700", label: "Pendiente" },
  ENTREGADO: { color: "bg-emerald-50 text-[#1B6B3E]", label: "Entregado" },
  NO_RECOGIDO: { color: "bg-red-50 text-red-700", label: "No recogido" },
};

export default function RutaDetail() {
  const { id } = useParams<{ id: string }>();
  const routeId = parseInt(id || "0");
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useFranchiseAuth();
  const utils = trpc.useUtils();

  // Solo Bodega y Chofer pueden acceder a Rutas
  useEffect(() => {
    if (!authLoading && user) {
      const isWarehouse = user?.franchise?.isWarehouse === 1;
      const isDriver = user?.username === "chofer";
      if (!isWarehouse && !isDriver) {
        navigate("/dashboard");
      }
    }
  }, [user, authLoading, navigate]);

  const { data: route, isLoading } = trpc.route.getById.useQuery(
    { id: routeId },
    { enabled: routeId > 0 }
  );

  const [expandedStopId, setExpandedStopId] = useState<number | null>(null);
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<number[]>([]);
  const [availableSelectedIds, setAvailableSelectedIds] = useState<number[]>([]);
  const [searchFilter, setSearchFilter] = useState("");

  // Confirmation dialog for route start
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: (() => void) | null;
  }>({ open: false, title: "", description: "", action: null });

  const openConfirmDialog = (title: string, description: string, onConfirm: () => void) => {
    setConfirmDialog({ open: true, title, description, action: onConfirm });
  };
  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, title: "", description: "", action: null });
  };

  // Auto-repair tracking for routes that are EN_RUTA but missing EN_RUTA tracking entries
  const repairMutation = trpc.route.repairTracking.useMutation({
    onSuccess: (data) => {
      if (data.fixed > 0) {
        utils.route.getById.invalidate({ id: routeId });
        toast.success(`${data.fixed} envios actualizados a En Ruta`);
      }
    },
  });

  useEffect(() => {
    if (route?.status === "EN_RUTA" && !repairMutation.isPending) {
      repairMutation.mutate({ routeId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.status]);

  const updateRouteMutation = trpc.route.updateStatus.useMutation({
    onSuccess: () => {
      utils.route.getById.invalidate({ id: routeId });
      utils.route.list.invalidate();
      utils.route.pendingByPickupPoint.invalidate();
      toast.success("Estado actualizado");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStopMutation = trpc.route.updateStop.useMutation({
    onSuccess: () => {
      utils.route.getById.invalidate({ id: routeId });
      utils.route.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateShipmentMutation = trpc.route.updateShipmentStatus.useMutation({
    onSuccess: () => {
      utils.route.getById.invalidate({ id: routeId });
      utils.route.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const moveShipmentMutation = trpc.route.moveShipment.useMutation({
    onSuccess: () => {
      utils.route.getById.invalidate({ id: routeId });
      utils.route.list.invalidate();
      toast.success("Envio movido");
    },
    onError: (err) => toast.error(err.message),
  });

  const assignMutation = trpc.route.assignShipments.useMutation({
    onSuccess: () => {
      toast.success("Envios asignados");
    },
    onError: (err) => toast.error(err.message),
  });
  const repairEnParadaMutation = trpc.route.repairEnParada.useMutation({
    onSuccess: (data) => {
      utils.route.getById.invalidate({ id: routeId });
      utils.route.list.invalidate();
      if (data.fixed > 0) {
        toast.success(`Reparados ${data.fixed} envios - ahora aparecen "En Parada"`);
      } else {
        toast.success("Todos los envios ya tienen el estado correcto");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: availableShipments } = trpc.route.availableShipments.useQuery(
    expandedStopId ? { stopId: expandedStopId } : undefined,
    { enabled: expandedStopId !== null }
  );

  // Get ALL available shipments for route assignment (all pickup points)
  const { data: allAvailableShipments } = trpc.route.availableShipments.useQuery(
    undefined,
    { enabled: route?.status === "PLANIFICADA" }
  );

  // Get ALL pending shipments to show alerts for stops that have unassigned shipments
  const { data: allPending } = trpc.route.pendingByPickupPoint.useQuery();

  const handleCall = (phone: string) => {
    window.open(`tel:${phone.replace(/-/g, "")}`, "_self");
  };

  const handleWhatsApp = (phone: string, trackingNumber: string, cityName: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Hola! Su pedido con guia ${trackingNumber} ya esta disponible para recoger en ${cityName}. El camion esta estacionado en el punto de referencia. Por favor pase a recogerlo. Gracias! - American Outlet`
    );
    window.open(`https://wa.me/506${cleanPhone}?text=${message}`, "_blank");
  };

  if (isLoading) {
    return (
      <FranchiseLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8102E]" />
        </div>
      </FranchiseLayout>
    );
  }

  if (!route) {
    return (
      <FranchiseLayout>
        <div className="text-center py-12 text-[#8A8A8A]">Ruta no encontrada</div>
      </FranchiseLayout>
    );
  }

  const routeCfg = routeStatusConfig[route.status];
  const allStopsCompleted = route.stops.every((s: any) => s.status === "COMPLETADO");

  // Collect ALL route shipments for unified list
  const allRouteShipments = route.stops.flatMap((stop: any) =>
    stop.shipments.map((rs: any) => ({ ...rs, stopName: stop.cityName, stopId: stop.id }))
  );

  // Select/deselect all
  const selectAllVisible = () => {
    const allSelected = allRouteShipments.every((rs: any) => selectedShipmentIds.includes(rs.shipment.id));
    if (allSelected) {
      setSelectedShipmentIds([]);
    } else {
      setSelectedShipmentIds(allRouteShipments.map((rs: any) => rs.shipment.id));
    }
  };
  const toggleShipment = (shipmentId: number) => {
    setSelectedShipmentIds(prev => prev.includes(shipmentId) ? prev.filter(id => id !== shipmentId) : [...prev, shipmentId]);
  };

  // Filter available shipments that match route cities
  const routeCityNames = route?.stops.map((s: any) => s.cityName.toLowerCase()) || [];
  const matchingAvailableShipments = (allAvailableShipments || []).filter((s: any) => {
    const destName = (s.destinationFranchise?.displayName || s.destinationFranchise?.name || "").toLowerCase();
    return routeCityNames.some((city: string) => destName.includes(city));
  });

  // Toggle available shipment selection
  const toggleAvailableShipment = (shipmentId: number) => {
    setAvailableSelectedIds(prev => prev.includes(shipmentId) ? prev.filter(id => id !== shipmentId) : [...prev, shipmentId]);
  };
  const selectAllAvailable = () => {
    if (availableSelectedIds.length === matchingAvailableShipments.length) {
      setAvailableSelectedIds([]);
    } else {
      setAvailableSelectedIds(matchingAvailableShipments.map((s: any) => s.id));
    }
  };

  // Assign selected available shipments to route
  const handleAssignToRoute = () => {
    if (availableSelectedIds.length === 0 || !route) return;
    // Group by stop (city) and assign to each stop
    const stopMap = new Map(route.stops.map((s: any) => [s.cityName.toLowerCase(), s.id]));
    const shipmentsByStop = new Map<number, number[]>();
    for (const shipment of matchingAvailableShipments) {
      if (!availableSelectedIds.includes(shipment.id)) continue;
      const destName = (shipment.destinationFranchise?.displayName || shipment.destinationFranchise?.name || "").toLowerCase();
      for (const [cityName, stopId] of stopMap) {
        if (destName.includes(cityName)) {
          if (!shipmentsByStop.has(stopId)) shipmentsByStop.set(stopId, []);
          shipmentsByStop.get(stopId)!.push(shipment.id);
          break;
        }
      }
    }
    // Assign to each stop
    for (const [stopId, shipmentIds] of shipmentsByStop) {
      assignMutation.mutate({ routeId, stopId, shipmentIds });
    }
    setAvailableSelectedIds([]);
    setTimeout(() => {
      utils.route.getById.invalidate({ id: routeId });
      utils.route.list.invalidate();
    }, 500);
  };

  return (
    <FranchiseLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/rutas")} className="text-[#8A8A8A] hover:text-[#C8102E]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-[#1A1A1A]">{route.name}</h1>
              {routeCfg && (
                <Badge variant="secondary" className={routeCfg.color}>
                  {routeCfg.label}
                </Badge>
              )}
            </div>
            <p className="text-sm text-[#8A8A8A] mt-1">
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              {new Date(route.createdAt).toLocaleDateString("es-CR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        {/* Alert: Pending shipments for this route's cities */}
        {allPending && allPending.length > 0 && (() => {
          const routeCityNames = route.stops.map((s: any) => s.cityName.toLowerCase());
          const pendingForRoute = allPending.filter(g =>
            routeCityNames.some((city: string) => g.cityName.toLowerCase().includes(city) || city.includes(g.cityName.toLowerCase()))
          );
          const totalUnassigned = pendingForRoute.reduce((sum, g) => sum + g.count, 0);
          if (totalUnassigned > 0) {
            return (
              <Card className="border-amber-300 bg-amber-50">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-800">Hay {totalUnassigned} envio{totalUnassigned !== 1 ? "s" : ""} pendiente{totalUnassigned !== 1 ? "s" : ""} por asignar</p>
                    <p className="text-sm text-amber-700 mt-1">
                      {pendingForRoute.map(g => `${g.cityName}: ${g.count}`).join(" | ")}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">Use "Asignar envios" en cada parada para agregarlos a la ruta</p>
                  </div>
                </CardContent>
              </Card>
            );
          }
          return null;
        })()}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Asignados", value: route.summary.totalAssigned, color: "text-blue-700", bg: "bg-blue-50" },
            { label: "Entregados", value: route.summary.totalDelivered, color: "text-[#1B6B3E]", bg: "bg-emerald-50" },
            { label: "Pendientes", value: route.summary.totalPending, color: "text-[#B8860B]", bg: "bg-amber-50" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className={`p-3 ${s.bg}`}>
                <p className="text-xs text-[#8A8A8A] uppercase tracking-wider font-semibold">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Route Actions — Same flow as shipments */}
        {route.status === "PLANIFICADA" && (
          <div className="flex gap-2">
            {selectedShipmentIds.length > 0 && (
              <Button
                onClick={() => {
                  const idsParam = selectedShipmentIds.join(",");
                  window.open(`/bitacora?ids=${idsParam}`, "_blank");
                }}
                variant="outline"
                className="flex-1 border-[#C8102E]/20 text-[#C8102E] hover:bg-[#FFF5F5]"
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                Generar Bitacora
              </Button>
            )}
            <Button
              onClick={() => {
                if (route.summary.totalAssigned === 0) {
                  toast.error("No hay envios asignados a la ruta");
                  return;
                }
                openConfirmDialog(
                  "Iniciar Ruta",
                  `Esta seguro de iniciar la ruta "${route.name}" con ${route.summary.totalAssigned} envio(s)? Esta accion no se puede deshacer.`,
                  () => updateRouteMutation.mutate({ id: routeId, status: "EN_RUTA" })
                );
              }}
              className="flex-1 bg-[#C8102E] hover:bg-[#9B0B22] h-11"
              disabled={updateRouteMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              {updateRouteMutation.isPending ? "Iniciando..." : "Iniciar Ruta"}
            </Button>
          </div>
        )}
        {route.status === "EN_RUTA" && allStopsCompleted && (
          <Button
            onClick={() => updateRouteMutation.mutate({ id: routeId, status: "COMPLETADA" })}
            className="w-full bg-[#1B6B3E] hover:bg-[#145a32] h-12 text-base"
            disabled={updateRouteMutation.isPending}
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            {updateRouteMutation.isPending ? "Completando..." : "Completar Ruta"}
          </Button>
        )}

        {/* Available Shipments — for assignment when route is PLANIFICADA */}
        {route.status === "PLANIFICADA" && matchingAvailableShipments.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#1A1A1A] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#B8860B]" />
                Envios Disponibles
                <Badge className="bg-amber-50 text-[#B8860B]">{matchingAvailableShipments.length}</Badge>
              </h2>
              <button
                onClick={selectAllAvailable}
                className="text-sm text-[#B8860B] hover:underline font-medium"
              >
                {availableSelectedIds.length === matchingAvailableShipments.length ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-lg border border-amber-200">
              <Checkbox
                checked={availableSelectedIds.length === matchingAvailableShipments.length && matchingAvailableShipments.length > 0}
                onCheckedChange={selectAllAvailable}
                className="border-amber-300 data-[state=checked]:bg-[#B8860B] data-[state=checked]:border-[#B8860B]"
              />
              <span className="text-sm text-[#525252] font-medium">
                {availableSelectedIds.length > 0
                  ? `${availableSelectedIds.length} seleccionado(s) para asignar`
                  : "Seleccionar envios para asignar a la ruta"}
              </span>
            </div>

            <div className="space-y-2">
              {matchingAvailableShipments.map((s: any) => {
                const isSelected = availableSelectedIds.includes(s.id);
                const destName = s.destinationFranchise?.displayName?.replace("Recogida - ", "") || s.destinationFranchise?.name || "-";
                return (
                  <Card key={s.id} className={`border-[#F0F0F0] hover:shadow-md transition-shadow ${isSelected ? "ring-2 ring-[#B8860B]/20 border-[#B8860B]/30" : ""}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleAvailableShipment(s.id)}
                          className="border-[#D4D4D4] data-[state=checked]:bg-[#B8860B] data-[state=checked]:border-[#B8860B]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-block bg-[#1A1A1A] text-white text-xs font-mono font-bold px-2 py-0.5 rounded">
                              {s.trackingNumber}
                            </span>
                            <Badge className="bg-orange-50 text-orange-700 border-orange-200">
                              <MapPin className="w-3 h-3 mr-1" />
                              {destName}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-[#525252]">
                            <span className="flex items-center gap-1"><User className="w-3 h-3" />{s.senderName}</span>
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.senderPhone}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {availableSelectedIds.length > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const idsParam = availableSelectedIds.join(",");
                    window.open(`/bitacora?ids=${idsParam}`, "_blank");
                  }}
                  variant="outline"
                  className="flex-1 border-[#C8102E]/20 text-[#C8102E] hover:bg-[#FFF5F5]"
                >
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Generar Bitacora
                </Button>
                <Button
                  onClick={handleAssignToRoute}
                  className="flex-1 bg-[#B8860B] hover:bg-[#8B6508]"
                  disabled={assignMutation.isPending}
                >
                  <Package className="w-4 h-4 mr-2" />
                  {assignMutation.isPending ? "Asignando..." : `Asignar ${availableSelectedIds.length} envio(s)`}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Unified Shipment List — Same flow as Shipments page */}
        <div className="space-y-3">
          {/* Section header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#1A1A1A] flex items-center gap-2">
              <Package className="w-5 h-5 text-[#C8102E]" />
              Envios de la Ruta
              <Badge className="bg-[#F0F0F0] text-[#525252]">{allRouteShipments.length}</Badge>
            </h2>
            {allRouteShipments.length > 1 && route.status === "PLANIFICADA" && (
              <button
                onClick={selectAllVisible}
                className="text-sm text-[#C8102E] hover:underline font-medium"
              >
                {allRouteShipments.every((rs: any) => selectedShipmentIds.includes(rs.shipment.id)) ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
            )}
          </div>

          {/* Select all bar */}
          {allRouteShipments.length > 0 && route.status === "PLANIFICADA" && (
            <div className="flex items-center gap-2 px-4 py-2 bg-[#F7F7F7] rounded-lg border border-[#D4D4D4]">
              <Checkbox
                checked={allRouteShipments.every((rs: any) => selectedShipmentIds.includes(rs.shipment.id))}
                onCheckedChange={selectAllVisible}
                className="border-[#D4D4D4] data-[state=checked]:bg-[#C8102E] data-[state=checked]:border-[#C8102E]"
              />
              <span className="text-sm text-[#525252] font-medium">
                {selectedShipmentIds.length > 0
                  ? `${selectedShipmentIds.length} seleccionado(s)`
                  : "Seleccionar todos los envios"}
              </span>
            </div>
          )}

          {/* Shipment cards */}
          {allRouteShipments.length === 0 ? (
            <Card className="border-[#D4D4D4]">
              <CardContent className="p-8 text-center">
                <Package className="w-10 h-10 text-[#D4D4D4] mx-auto mb-2" />
                <p className="text-[#8A8A8A]">No hay envios asignados a esta ruta</p>
              </CardContent>
            </Card>
          ) : (
            allRouteShipments.map((rs: any) => {
              const s = rs.shipment;
              if (!s) return null;
              const shCfg = shipmentStatusConfig[rs.status];
              const isSelected = selectedShipmentIds.includes(s.id);

              return (
                <Card key={rs.id} className={`border-[#F0F0F0] hover:shadow-md transition-shadow ${isSelected ? "ring-2 ring-[#C8102E]/20 border-[#C8102E]/30" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Checkbox (only for PLANIFICADA) */}
                      {route.status === "PLANIFICADA" && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleShipment(s.id)}
                          className="border-[#D4D4D4] data-[state=checked]:bg-[#C8102E] data-[state=checked]:border-[#C8102E]"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Top row: tracking + status + city */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-block bg-[#1A1A1A] text-white text-xs font-mono font-bold px-2 py-0.5 rounded">
                            {s.trackingNumber}
                          </span>
                          {shCfg && <Badge variant="secondary" className={shCfg.color}>{shCfg.label}</Badge>}
                          <Badge className="bg-orange-50 text-orange-700 border-orange-200">
                            <MapPin className="w-3 h-3 mr-1" />
                            {rs.stopName}
                          </Badge>
                        </div>

                        {/* Client info */}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-[#525252]">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{s.senderName}</span>
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.senderPhone}</span>
                        </div>

                        {/* Items */}
                        <p className="text-xs text-[#8A8A8A] mt-0.5 truncate">
                          {s.items?.map((i: any) => `${i.description} x${i.quantity}`).join(", ")}
                        </p>
                      </div>

                      {/* Action buttons (only when EN_RUTA and stop is LLEGADO) */}
                      {route.status === "EN_RUTA" && rs.status === "ASIGNADO" && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => handleCall(s.senderPhone)} className="h-8 px-2">
                            <Phone className="w-3.5 h-3.5 text-[#1B6B3E]" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleWhatsApp(s.senderPhone, s.trackingNumber, rs.stopName)} className="h-8 px-2">
                            <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateShipmentMutation.mutate({ routeShipmentId: rs.id, status: "ENTREGADO" })}
                            className="bg-[#1B6B3E] hover:bg-[#145a32] h-8 px-2"
                            disabled={updateShipmentMutation.isPending}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateShipmentMutation.mutate({ routeShipmentId: rs.id, status: "NO_RECOGIDO" })}
                            className="text-red-600 h-8 px-2"
                            disabled={updateShipmentMutation.isPending}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Stops progress (compact visual) */}
        {route.stops.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[#8A8A8A] uppercase tracking-wider">Paradas del recorrido</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {route.stops.map((stop: any, idx: number) => {
                const stopCfg = stopStatusConfig[stop.status];
                const isCurrent = route.status === "EN_RUTA" && stop.status === "PENDIENTE" &&
                  (idx === 0 || route.stops[idx - 1].status === "COMPLETADO");
                return (
                  <div key={stop.id} className="flex items-center gap-2">
                    <div className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                      stop.status === "COMPLETADO" ? "bg-emerald-50 text-[#1B6B3E] border-emerald-200" :
                      stop.status === "LLEGADO" ? "bg-amber-50 text-[#B8860B] border-amber-200" :
                      isCurrent ? "bg-[#FFF5F5] text-[#C8102E] border-[#C8102E]" :
                      "bg-[#F7F7F7] text-[#8A8A8A] border-[#F0F0F0]"
                    }`}>
                      {idx + 1}. {stop.cityName}
                      {stop.totalShipments > 0 && ` (${stop.totalShipments})`}
                    </div>
                    {route.status === "EN_RUTA" && stop.status === "PENDIENTE" && isCurrent && (
                      <Button
                        size="sm"
                        onClick={() => updateStopMutation.mutate({ stopId: stop.id, status: "LLEGADO" })}
                        className="bg-[#B8860B] hover:bg-[#8B6508] h-7 text-xs"
                        disabled={updateStopMutation.isPending}
                      >
                        <MapPin className="w-3 h-3 mr-1" />
                        Llego
                      </Button>
                    )}
                    {stop.status === "LLEGADO" && (
                      <Button
                        size="sm"
                        onClick={() => updateStopMutation.mutate({ stopId: stop.id, status: "COMPLETADO" })}
                        className="bg-[#1B6B3E] hover:bg-[#145a32] h-7 text-xs"
                        disabled={updateStopMutation.isPending}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Completar
                      </Button>
                    )}
                    {idx < route.stops.length - 1 && <ChevronRight className="w-4 h-4 text-[#D4D4D4]" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
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
