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
  ASIGNADO: { color: "bg-blue-50 text-blue-700", label: "En Ruta" },
  EN_PARADA: { color: "bg-amber-50 text-[#B8860B]", label: "En Parada" },
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
      utils.shipment.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateShipmentMutation = trpc.route.updateShipmentStatus.useMutation({
    onSuccess: () => {
      utils.route.getById.invalidate({ id: routeId });
      utils.route.list.invalidate();
      toast.success("Estado actualizado correctamente");
    },
    onError: (err) => {
      console.error("updateShipmentStatus error:", err);
      toast.error(`Error: ${err.message}`);
    },
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
      // Invalidate queries to refresh the lists
      utils.route.availableShipments.invalidate();
      utils.route.getById.invalidate({ id: routeId });
      utils.route.list.invalidate();
      utils.route.pendingByPickupPoint.invalidate();
      // Clear selection
      setAvailableSelectedIds([]);
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
  const handleAssignToRoute = async () => {
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
    // Assign to each stop and wait for all to complete
    const promises = [];
    for (const [stopId, shipmentIds] of shipmentsByStop) {
      promises.push(assignMutation.mutateAsync({ routeId, stopId, shipmentIds }));
    }
    try {
      await Promise.all(promises);
      // After all assignments complete, invalidate queries
      utils.route.availableShipments.invalidate();
      utils.route.getById.invalidate({ id: routeId });
      utils.route.list.invalidate();
      utils.route.pendingByPickupPoint.invalidate();
      setAvailableSelectedIds([]);
    } catch (err) {
      // Error handled by mutation onError
    }
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
            {availableSelectedIds.length > 0 && (
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
                  disabled={assignMutation.isPending || availableSelectedIds.length === 0}
                >
                  <Package className="w-4 h-4 mr-2" />
                  {assignMutation.isPending ? "Asignando..." : `Asignar ${availableSelectedIds.length} envio(s)`}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Shipments grouped by city — each city is a section */}
        {route.stops.map((stop: any, idx: number) => {
          const stopCfg = stopStatusConfig[stop.status];
          const isCurrent = route.status === "EN_RUTA" && stop.status === "PENDIENTE" &&
            (idx === 0 || route.stops[idx - 1].status === "COMPLETADO");
          const stopShipments = stop.shipments || [];

          return (
            <div key={stop.id} className="space-y-3">
              {/* City Header with action button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    stop.status === "COMPLETADO" ? "bg-[#1B6B3E] text-white" :
                    stop.status === "LLEGADO" ? "bg-[#B8860B] text-white" :
                    isCurrent ? "bg-[#C8102E] text-white" : "bg-[#F0F0F0] text-[#8A8A8A]"
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#1A1A1A]">{stop.cityName}</h3>
                    <div className="flex items-center gap-2 text-xs">
                      {stopCfg && <Badge variant="secondary" className={stopCfg.color}>{stopCfg.label}</Badge>}
                      <span className="text-[#8A8A8A]">{stopShipments.length} envio{stopShipments.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>
                {/* Action buttons */}
                {route.status === "EN_RUTA" && stop.status === "PENDIENTE" && isCurrent && (
                  <Button
                    size="sm"
                    onClick={() => updateStopMutation.mutate({ stopId: stop.id, status: "LLEGADO" })}
                    className="bg-[#B8860B] hover:bg-[#8B6508]"
                    disabled={updateStopMutation.isPending}
                  >
                    <MapPin className="w-4 h-4 mr-1.5" />
                    Llego
                  </Button>
                )}
                {stop.status === "LLEGADO" && (
                  <Button
                    size="sm"
                    onClick={() => updateStopMutation.mutate({ stopId: stop.id, status: "COMPLETADO" })}
                    className="bg-[#1B6B3E] hover:bg-[#145a32]"
                    disabled={updateStopMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Completar
                  </Button>
                )}
              </div>

              {/* Shipments for this city */}
              {stopShipments.length === 0 ? (
                <Card className="border-[#D4D4D4]">
                  <CardContent className="p-6 text-center">
                    <Package className="w-8 h-8 text-[#D4D4D4] mx-auto mb-1" />
                    <p className="text-sm text-[#8A8A8A]">Sin envios para {stop.cityName}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {stopShipments.map((rs: any) => {
                    const s = rs.shipment;
                    if (!s) return null;
                    const shCfg = shipmentStatusConfig[rs.status];
                    return (
                      <Card key={rs.id} className="border-[#F0F0F0] hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-block bg-[#1A1A1A] text-white text-xs font-mono font-bold px-2 py-0.5 rounded">
                                  {s.trackingNumber}
                                </span>
                                {shCfg && <Badge variant="secondary" className={shCfg.color}>{shCfg.label}</Badge>}
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-[#525252]">
                                <span className="flex items-center gap-1"><User className="w-3 h-3" />{s.senderName}</span>
                                <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.senderPhone}</span>
                              </div>
                              <p className="text-xs text-[#8A8A8A] mt-0.5 truncate">
                                {s.items?.map((i: any) => `${i.description} x${i.quantity}`).join(", ")}
                              </p>
                            </div>
                            {/* WhatsApp only — no phone call */}
                            {route.status === "EN_RUTA" && (rs.status === "ASIGNADO" || rs.status === "EN_PARADA" || rs.status === "NO_RECOGIDO") && (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleWhatsApp(s.senderPhone, s.trackingNumber, stop.cityName)}
                                  className="h-9 px-3 bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366] hover:text-white"
                                >
                                  <MessageCircle className="w-4 h-4 mr-1.5" />
                                  WhatsApp
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    console.log("ENTREGADO click - routeShipmentId:", rs.id);
                                    updateShipmentMutation.mutate(
                                      { routeShipmentId: rs.id, status: "ENTREGADO" },
                                      {
                                        onSuccess: (data) => console.log("ENTREGADO success:", data),
                                        onError: (err) => console.error("ENTREGADO error:", err),
                                      }
                                    );
                                  }}
                                  className="bg-[#1B6B3E] hover:bg-[#145a32] h-9 px-2"
                                  disabled={updateShipmentMutation.isPending}
                                >
                                  {updateShipmentMutation.isPending ? "..." : <CheckCircle className="w-4 h-4" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    console.log("NO_RECOGIDO click - routeShipmentId:", rs.id);
                                    updateShipmentMutation.mutate(
                                      { routeShipmentId: rs.id, status: "NO_RECOGIDO" },
                                      {
                                        onSuccess: (data) => console.log("NO_RECOGIDO success:", data),
                                        onError: (err) => console.error("NO_RECOGIDO error:", err),
                                      }
                                    );
                                  }}
                                  className="text-red-600 h-9 px-2 hover:bg-red-50"
                                  disabled={updateShipmentMutation.isPending}
                                >
                                  {updateShipmentMutation.isPending ? "..." : <XCircle className="w-4 h-4" />}
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

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
