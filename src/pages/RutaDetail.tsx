import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Truck, MapPin, Phone, Package, CheckCircle, XCircle, Play, ArrowLeft,
  ChevronRight, AlertCircle, Clock, User, Calendar, ArrowUpRight, MessageCircle,
  AlertTriangle, Search,
} from "lucide-react";
import toast from "react-hot-toast";

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

  const [assignDialog, setAssignDialog] = useState<number | null>(null);
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<number[]>([]);
  const [searchFilter, setSearchFilter] = useState("");

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
      // Refresh all related data
      utils.route.getById.invalidate({ id: routeId });
      utils.route.availableShipments.invalidate();
      utils.route.pendingByPickupPoint.invalidate();
      utils.route.list.invalidate();
      toast.success("Envios asignados exitosamente");
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: availableShipments } = trpc.route.availableShipments.useQuery(
    assignDialog ? { stopId: assignDialog } : undefined,
    { enabled: assignDialog !== null }
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
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Asignados", value: route.summary.totalAssigned, color: "text-blue-700", bg: "bg-blue-50" },
            { label: "Entregados", value: route.summary.totalDelivered, color: "text-[#1B6B3E]", bg: "bg-emerald-50" },
            { label: "Pendientes", value: route.summary.totalPending, color: "text-[#B8860B]", bg: "bg-amber-50" },
            { label: "No recogidos", value: route.summary.totalNotCollected, color: "text-red-700", bg: "bg-red-50" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className={`p-3 ${s.bg}`}>
                <p className="text-xs text-[#8A8A8A] uppercase tracking-wider font-semibold">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Route Actions */}
        {route.status === "PLANIFICADA" && (
          <Button
            onClick={() => updateRouteMutation.mutate({ id: routeId, status: "EN_RUTA" })}
            className="w-full bg-[#C8102E] hover:bg-[#9B0B22] h-12 text-base"
            disabled={updateRouteMutation.isPending}
          >
            <Play className="w-5 h-5 mr-2" />
            {updateRouteMutation.isPending ? "Iniciando..." : "Iniciar Ruta"}
          </Button>
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

        {/* Stops */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A] flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#C8102E]" />
            Paradas
          </h2>

          {route.stops.map((stop: any, idx: number) => {
            const stopCfg = stopStatusConfig[stop.status];
            const isCurrent = route.status === "EN_RUTA" && stop.status === "PENDIENTE" &&
              (idx === 0 || route.stops[idx - 1].status === "COMPLETADO");

            return (
              <Card key={stop.id} className={`border-2 ${isCurrent ? "border-[#C8102E]" : "border-[#F0F0F0]"}`}>
                <CardContent className="p-4">
                  {/* Stop Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        stop.status === "COMPLETADO" ? "bg-[#1B6B3E] text-white" :
                        stop.status === "LLEGADO" ? "bg-[#B8860B] text-white" :
                        isCurrent ? "bg-[#C8102E] text-white" : "bg-[#F0F0F0] text-[#8A8A8A]"
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-[#1A1A1A]">{stop.cityName}</p>
                        <div className="flex items-center gap-2 text-xs">
                          {stopCfg && <Badge variant="secondary" className={stopCfg.color}>{stopCfg.label}</Badge>}
                          <span className="text-[#8A8A8A]">
                            {stop.totalShipments} envio{stop.totalShipments !== 1 ? "s" : ""}
                            {stop.delivered > 0 && ` (${stop.delivered} entregados)`}
                          </span>
                          {(() => {
                            const pendingForStop = allPending?.find(g =>
                              stop.cityName.toLowerCase().includes(g.cityName.toLowerCase()) ||
                              g.cityName.toLowerCase().includes(stop.cityName.toLowerCase())
                            );
                            if (pendingForStop && pendingForStop.count > 0) {
                              return (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  {pendingForStop.count} sin asignar
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {route.status === "EN_RUTA" && stop.status === "PENDIENTE" && isCurrent && (
                        <Button
                          size="sm"
                          onClick={() => updateStopMutation.mutate({ stopId: stop.id, status: "LLEGADO" })}
                          className="bg-[#B8860B] hover:bg-[#8B6508]"
                          disabled={updateStopMutation.isPending}
                        >
                          <MapPin className="w-3.5 h-3.5 mr-1" />
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
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          Completar
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Shipments */}
                  {stop.shipments.length > 0 && (
                    <div className="space-y-2 mt-3 pt-3 border-t border-[#F0F0F0]">
                      {stop.shipments.map((rs: any) => {
                        const s = rs.shipment;
                        if (!s) return null;
                        const shCfg = shipmentStatusConfig[rs.status];
                        return (
                          <div key={rs.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#F7F7F7]">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-block bg-[#1A1A1A] text-white text-xs font-mono font-bold px-2 py-0.5 rounded">
                                  {s.trackingNumber}
                                </span>
                                {shCfg && <Badge variant="secondary" className={shCfg.color}>{shCfg.label}</Badge>}
                                <span className="text-xs text-orange-600 font-semibold bg-orange-50 px-1.5 py-0.5 rounded">
                                  <MapPin className="w-3 h-3 inline mr-0.5" />
                                  {s.destinationFranchise?.displayName?.replace("Recogida - ", "") || s.destinationFranchise?.name || "-"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-[#525252]">
                                <span className="flex items-center gap-1"><User className="w-3 h-3" />{s.senderName}</span>
                                <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.senderPhone}</span>
                              </div>
                              <p className="text-xs text-[#8A8A8A] mt-0.5 truncate">
                                {s.items?.map((i: any) => `${i.description} x${i.quantity}`).join(", ")}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {rs.status === "ASIGNADO" && stop.status !== "LLEGADO" && (
                                <select
                                  className="text-xs border border-[#D4D4D4] rounded px-2 py-1 bg-white"
                                  onChange={(e) => {
                                    const newStopId = parseInt(e.target.value);
                                    if (newStopId) {
                                      moveShipmentMutation.mutate({ routeShipmentId: rs.id, newStopId });
                                      e.target.value = "";
                                    }
                                  }}
                                  disabled={moveShipmentMutation.isPending}
                                >
                                  <option value="">Mover a...</option>
                                  {route.stops
                                    .filter((otherStop: any) => otherStop.id !== stop.id)
                                    .map((otherStop: any) => (
                                      <option key={otherStop.id} value={otherStop.id}>
                                        {otherStop.cityName}
                                      </option>
                                    ))}
                                </select>
                              )}
                              {rs.status === "ASIGNADO" && stop.status === "LLEGADO" && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handleCall(s.senderPhone)} className="h-8 px-2">
                                    <Phone className="w-3.5 h-3.5 text-[#1B6B3E]" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleWhatsApp(s.senderPhone, s.trackingNumber, stop.cityName)} className="h-8 px-2">
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
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Assign shipments button */}
                  {(route.status === "PLANIFICADA" || route.status === "EN_RUTA") && stop.status !== "COMPLETADO" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAssignDialog(stop.id)}
                      className="mt-3 text-[#C8102E]"
                    >
                      <Package className="w-3.5 h-3.5 mr-1" />
                      Asignar envios
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Assign Shipments Dialog */}
      <Dialog open={assignDialog !== null} onOpenChange={(open) => { if (!open) { setAssignDialog(null); setSelectedShipmentIds([]); setSearchFilter(""); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-[#C8102E]" />
              Asignar envios a parada
            </DialogTitle>
          </DialogHeader>
          {!availableShipments || availableShipments.length === 0 ? (
            <div className="text-center py-8 text-[#8A8A8A]">
              <Package className="w-10 h-10 text-[#D4D4D4] mx-auto mb-2" />
              <p>No hay envios disponibles para esta parada</p>
              <p className="text-xs mt-1">Solo se muestran envios en bodega con destino a esta ciudad</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#8A8A8A]">{availableShipments.length} envios disponibles</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedShipmentIds(availableShipments.map(s => s.id))}
                  >
                    Seleccionar Todos
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedShipmentIds([])}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>

              {/* Search filter */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
                <input
                  type="text"
                  placeholder="Buscar por tracking, factura, nombre..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent"
                />
              </div>

              {availableShipments
                .filter(s => {
                  const q = searchFilter.toLowerCase();
                  return !q ||
                    s.trackingNumber?.toLowerCase().includes(q) ||
                    s.invoiceNumber?.toLowerCase().includes(q) ||
                    s.senderName?.toLowerCase().includes(q) ||
                    s.senderPhone?.includes(q) ||
                    s.items?.some((i: any) => i.description.toLowerCase().includes(q));
                })
                .map((s) => (
                <div
                  key={s.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedShipmentIds.includes(s.id) ? "border-[#C8102E] bg-[#FFF5F5]" : "border-[#F0F0F0] hover:border-[#D4D4D4]"
                  }`}
                  onClick={() => {
                    setSelectedShipmentIds(prev =>
                      prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id]
                    );
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selectedShipmentIds.includes(s.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#1A1A1A]">{s.trackingNumber}</span>
                        <span className="text-xs text-[#525252]">{s.senderName}</span>
                      </div>
                      <p className="text-xs text-[#8A8A8A] truncate">
                        {s.items?.map((i: any) => `${i.description} x${i.quantity}`).join(", ")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <Button
                onClick={() => {
                  if (assignDialog && selectedShipmentIds.length > 0) {
                    const stopId = assignDialog;
                    const shipmentIds = [...selectedShipmentIds];
                    // Close dialog and clear state immediately
                    setAssignDialog(null);
                    setSelectedShipmentIds([]);
                    setSearchFilter("");
                    // Then execute mutation
                    assignMutation.mutate({ routeId, stopId, shipmentIds });
                  }
                }}
                className="w-full bg-[#C8102E] hover:bg-[#9B0B22]"
                disabled={assignMutation.isPending || selectedShipmentIds.length === 0}
              >
                {assignMutation.isPending ? "Asignando..." : `Asignar ${selectedShipmentIds.length} envio${selectedShipmentIds.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FranchiseLayout>
  );
}
