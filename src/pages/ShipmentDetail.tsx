import { useParams, useNavigate } from "react-router";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Truck, Package, CheckCircle, MapPin,
  Send, RotateCcw, User, Phone, Barcode, FileText, ClipboardCheck,
  Zap, Ban, Printer,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import toast from "react-hot-toast";

// Safe helper to get status config - never returns undefined
function getStatusConfig(status: string) {
  const configs: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    CREADO: { color: "bg-[#F7F7F7] text-[#404040]", label: "Creado", icon: Package },
    ENVIADO_A_BODEGA: { color: "bg-amber-100 text-amber-700", label: "Enviado a Bodega", icon: Send },
    RECIBIDO_EN_BODEGA: { color: "bg-purple-100 text-purple-700", label: "Recibido en Bodega", icon: ClipboardCheck },
    ENVIADO_A_DESTINO: { color: "bg-[#FFF5F5] text-[#C8102E]", label: "Enviado a Destino", icon: Truck },
    EN_RUTA: { color: "bg-blue-100 text-blue-700", label: "En Ruta de Camion", icon: Truck },
    EN_PARADA: { color: "bg-orange-100 text-orange-700", label: "En Punto de Recogida", icon: MapPin },
    RECIBIDO_EN_DESTINO: { color: "bg-emerald-100 text-emerald-700", label: "Entregado", icon: CheckCircle },
    CANCELADO: { color: "bg-red-100 text-red-700", label: "Cancelado", icon: Ban },
  };
  return configs[status] || { color: "bg-gray-100 text-gray-500", label: status, icon: Package };
}

// Timeline para envios a TIENDAS NORMALES (sin EN_RUTA ni EN_PARADA)
const storeTimeline = [
  { status: "CREADO", label: "Creado" },
  { status: "ENVIADO_A_BODEGA", label: "Enviado a Bodega" },
  { status: "RECIBIDO_EN_BODEGA", label: "En Bodega" },
  { status: "ENVIADO_A_DESTINO", label: "Enviado a Destino" },
  { status: "RECIBIDO_EN_DESTINO", label: "Entregado" },
];

// Timeline para envios a PUNTOS DE RECOGIDA (con EN_RUTA y EN_PARADA)
const pickupTimeline = [
  { status: "CREADO", label: "Creado" },
  { status: "ENVIADO_A_BODEGA", label: "Enviado a Bodega" },
  { status: "RECIBIDO_EN_BODEGA", label: "En Bodega" },
  { status: "EN_RUTA", label: "En Ruta" },
  { status: "EN_PARADA", label: "En Parada" },
  { status: "RECIBIDO_EN_DESTINO", label: "Entregado" },
];

// Timeline para envio DIRECTO de bodega a PUNTO DE RECOGIDA
const directPickupTimeline = [
  { status: "CREADO", label: "Creado" },
  { status: "ENVIADO_A_DESTINO", label: "Enviado a Destino" },
  { status: "EN_RUTA", label: "En Ruta" },
  { status: "EN_PARADA", label: "En Parada" },
  { status: "RECIBIDO_EN_DESTINO", label: "Entregado" },
];

// Timeline para envio DIRECTO de bodega a TIENDA
const directStoreTimeline = [
  { status: "CREADO", label: "Creado" },
  { status: "ENVIADO_A_DESTINO", label: "Enviado a Destino" },
  { status: "RECIBIDO_EN_DESTINO", label: "Entregado" },
];

export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const shipmentId = parseInt(id || "0");
  const { user } = useFranchiseAuth();
  const [actionNotes, setActionNotes] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState<string | null>(null);

  const { data: shipment, isLoading, error: queryError } = trpc.shipment.getById.useQuery(
    { id: shipmentId }, { enabled: shipmentId > 0 }
  );

  if (queryError) {
    return (
      <FranchiseLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/envios")}><ArrowLeft className="w-4 h-4" /></Button>
            <h1 className="text-xl font-bold text-[#1A1A1A]">Error</h1>
          </div>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <p className="text-red-700">{queryError.message || "No tiene permiso para ver este envio"}</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate("/envios")}>
                <ArrowLeft className="w-4 h-4 mr-2" />Volver a Mis Envios
              </Button>
            </CardContent>
          </Card>
        </div>
      </FranchiseLayout>
    );
  }

  const originIsWarehouse = shipment?.originFranchise?.isWarehouse === 1;
  const utils = trpc.useUtils();

  const updateStatusMutation = trpc.shipment.updateStatus.useMutation({
    onSuccess: () => {
      utils.shipment.getById.invalidate({ id: shipmentId });
      utils.shipment.list.invalidate();
      utils.shipment.stats.invalidate();
      utils.shipment.pendingCount.invalidate();
      setDialogOpen(null);
      setActionNotes("");
      setReceiverName("");
      toast.success("Estado actualizado correctamente");
    },
    onError: (err) => {
      toast.error(err.message || "Error al actualizar");
    },
  });

  const cancelMutation = trpc.shipment.cancel.useMutation({
    onSuccess: () => {
      utils.shipment.getById.invalidate({ id: shipmentId });
      utils.shipment.list.invalidate();
      utils.shipment.stats.invalidate();
      utils.shipment.pendingCount.invalidate();
      setCancelReason("");
      toast.success("Envio cancelado");
    },
    onError: (err) => {
      toast.error(err.message || "Error al cancelar");
    },
  });

  const handleStatusUpdate = (newStatus: string) => {
    updateStatusMutation.mutate({
      id: shipmentId,
      newStatus: newStatus as any,
      notes: actionNotes.trim() || undefined,
      receiverName: newStatus === "RECIBIDO_EN_DESTINO" ? receiverName.trim() || undefined : undefined,
    });
  };

  const handleCancel = () => {
    cancelMutation.mutate({ id: shipmentId, reason: cancelReason.trim() || undefined });
  };

  if (isLoading) {
    return (
      <FranchiseLayout>
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
      </FranchiseLayout>
    );
  }

  if (!shipment) {
    return (
      <FranchiseLayout>
        <div className="text-center py-12">
          <p className="text-[#8A8A8A]">Envio no encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/envios")}><ArrowLeft className="w-4 h-4 mr-2" />Volver</Button>
        </div>
      </FranchiseLayout>
    );
  }

  const franchiseId = user?.franchiseId || 0;
  const isOrigin = shipment.originFranchiseId === franchiseId;
  const isDestination = shipment.destinationFranchiseId === franchiseId;
  const isWarehouseUser = user?.franchise?.isWarehouse === 1;
  const isCancelled = shipment.status === "CANCELADO";
  const isDelivered = shipment.status === "RECIBIDO_EN_DESTINO";
  const canCancel = !isCancelled && !isDelivered && (isOrigin || isDestination || shipment.currentLocationId === franchiseId);

  // ─── AVAILABLE ACTIONS ──────────────────────────────────────
  const availableActions: { label: string; status: string; icon: React.ReactNode; color: string; desc: string; needsReceiver?: boolean }[] = [];

  if (!isCancelled && !isDelivered) {
    if (originIsWarehouse) {
      if (shipment.status === "CREADO" && isOrigin) {
        availableActions.push({ label: "Confirmar Envio Directo", status: "ENVIADO_A_DESTINO", icon: <Zap className="w-4 h-4" />, color: "bg-[#C8102E] hover:bg-[#9B0B22]", desc: "Confirmar envio directo desde bodega" });
      }
    } else {
      if (shipment.status === "CREADO" && isOrigin) {
        availableActions.push({ label: "Confirmar Envio a Bodega", status: "ENVIADO_A_BODEGA", icon: <Send className="w-4 h-4" />, color: "bg-amber-600 hover:bg-amber-700", desc: "Confirmar que el paquete fue enviado a bodega" });
      }
      if (shipment.status === "ENVIADO_A_BODEGA" && isWarehouseUser) {
        availableActions.push({ label: "Confirmar Recepcion", status: "RECIBIDO_EN_BODEGA", icon: <ClipboardCheck className="w-4 h-4" />, color: "bg-purple-600 hover:bg-purple-700", desc: "Confirmar recepcion en bodega" });
      }
      if (shipment.status === "RECIBIDO_EN_BODEGA" && isWarehouseUser) {
        availableActions.push({ label: "Enviar a Destino", status: "ENVIADO_A_DESTINO", icon: <Truck className="w-4 h-4" />, color: "bg-[#C8102E] hover:bg-[#9B0B22]", desc: "Confirmar envio a tienda de destino" });
      }
    }
    if (shipment.status === "ENVIADO_A_DESTINO" && isDestination) {
      availableActions.push({ label: "Confirmar Recepcion", status: "RECIBIDO_EN_DESTINO", icon: <CheckCircle className="w-4 h-4" />, color: "bg-emerald-600 hover:bg-emerald-700", desc: "Confirmar recepcion en destino", needsReceiver: true });
    }
  }

  // Backend tells us directly if this is a pickup route
  const isPickupRoute = (shipment as any).isPickupRoute || false;

  // Choose correct timeline: route timeline if backend says it's a pickup route
  let timelineSteps;
  if (isPickupRoute) {
    timelineSteps = originIsWarehouse ? directPickupTimeline : pickupTimeline;
  } else {
    timelineSteps = originIsWarehouse ? directStoreTimeline : storeTimeline;
  }
  const currentStepIndex = timelineSteps.findIndex((s) => s.status === shipment.status);

  return (
    <FranchiseLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/envios")}><ArrowLeft className="w-4 h-4" /></Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <Barcode className="w-5 h-5 text-[#C8102E]" />
              <h1 className="text-xl font-bold text-[#1A1A1A] font-mono">{shipment.trackingNumber}</h1>
              {(() => { const cfg = getStatusConfig(shipment.status); return <Badge variant="secondary" className={cfg.color}><cfg.icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>; })()}
            </div>
            {shipment.invoiceNumber && <p className="text-sm text-[#8A8A8A] mt-1 flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Factura: #{shipment.invoiceNumber}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={() => window.open(`/boleta/${shipment.id}`, "_blank")}>
            <Printer className="w-4 h-4 mr-1" />Boleta
          </Button>
          {canCancel && (
            <Dialog open={dialogOpen === "CANCEL"} onOpenChange={(open) => { setDialogOpen(open ? "CANCEL" : null); if (!open) setCancelReason(""); }}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm"><Ban className="w-4 h-4 mr-1" />Cancelar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-red-600 flex items-center gap-2"><Ban className="w-5 h-5" />Cancelar Envio</DialogTitle>
                  <DialogDescription>Esta accion no se puede deshacer. El envio quedara como cancelado.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Textarea placeholder="Motivo de cancelacion (opcional)..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(null)}>Volver</Button>
                  <Button variant="destructive" onClick={handleCancel} disabled={cancelMutation.isPending}>
                    {cancelMutation.isPending ? <RotateCcw className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
                    Confirmar Cancelacion
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Direct flow badge */}
        {originIsWarehouse && !isCancelled && (
          <Card className="bg-[#FFF5F5] border-[#C8102E]/20"><CardContent className="p-3 flex items-center gap-2"><Zap className="w-4 h-4 text-[#C8102E]" /><span className="text-sm text-[#C8102E] font-medium">Envio Directo desde Bodega - Flujo acelerado</span></CardContent></Card>
        )}
        {isCancelled && (
          <Card className="bg-red-50 border-red-200"><CardContent className="p-3 flex items-center gap-2"><Ban className="w-4 h-4 text-red-600" /><span className="text-sm text-red-700 font-medium">Este envio ha sido cancelado</span></CardContent></Card>
        )}

        {/* Cliente + Articulos */}
        <Card>
          <CardContent className="p-4">
            {/* Info del Cliente */}
            <p className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wider mb-3">Informacion del Cliente</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-2"><User className="w-4 h-4 text-[#C8102E]" /><div><p className="text-xs text-[#8A8A8A]">Remitente</p><p className="font-medium text-[#1A1A1A]">{shipment.senderName}</p></div></div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#C8102E]" /><div><p className="text-xs text-[#8A8A8A]">Telefono</p><p className="font-medium text-[#1A1A1A]">{shipment.senderPhone}</p></div></div>
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#C8102E]" /><div><p className="text-xs text-[#8A8A8A]">Ubicacion</p><p className="font-medium text-[#1A1A1A]">{shipment.currentLocation?.displayName || "-"}</p></div></div>
            </div>
            {shipment.receiverName && (
              <div className="mt-3 pt-3 border-t border-[#F0F0F0] flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="text-xs text-[#8A8A8A]">Recibido por</p>
                  <p className="font-medium text-emerald-700">{shipment.receiverName}</p>
                </div>
              </div>
            )}

            {/* Articulos del Cliente */}
            <div className="mt-4 pt-4 border-t-2 border-[#F0F0F0]">
              <p className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wider mb-3">Articulos del Envio ({shipment.items?.length || 0})</p>
              <div className="space-y-3">
                {shipment.items?.map((item: { id: number; description: string; quantity: number; details?: string | null }) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-[#F7F7F7] rounded-lg">
                    <div className="flex-1"><p className="font-medium text-[#1A1A1A]">{item.description}</p>{item.details && <p className="text-sm text-[#8A8A8A]">{item.details}</p>}</div>
                    <Badge variant="secondary" className="ml-4">Cant: {item.quantity}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        {availableActions.length > 0 && (
          <Card className="border-[#C8102E]/20 bg-[#FFF5F5]/30">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">Acciones Disponibles</h3>
              <div className="flex flex-wrap gap-3">
                {availableActions.map((action) => (
                  <Dialog key={action.status} open={dialogOpen === action.status} onOpenChange={(open) => { setDialogOpen(open ? action.status : null); if (!open) { setActionNotes(""); setReceiverName(""); } }}>
                    <DialogTrigger asChild><Button className={action.color}>{action.icon}<span className="ml-2">{action.label}</span></Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{action.label}</DialogTitle><DialogDescription>{action.desc}</DialogDescription></DialogHeader>
                      <div className="space-y-4 py-4">
                        {action.needsReceiver && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Nombre de quien recibe *</label>
                            <input type="text" className="w-full px-3 py-2 border rounded-md" placeholder="Ej: Juan Perez" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
                          </div>
                        )}
                        <Textarea placeholder="Notas opcionales..." value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setDialogOpen(null); setActionNotes(""); setReceiverName(""); }}>Cancelar</Button>
                        <Button className={action.color} onClick={() => handleStatusUpdate(action.status)} disabled={updateStatusMutation.isPending || (action.needsReceiver && !receiverName.trim())}>
                          {updateStatusMutation.isPending ? <RotateCcw className="w-4 h-4 mr-2 animate-spin" /> : action.icon}
                          Confirmar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        {!isCancelled && (
          <Card>
            <CardHeader><CardTitle className="text-base">Progreso del Envio</CardTitle></CardHeader>
            <CardContent>
              <div className="relative">
                <div className="flex items-center justify-between">
                  {timelineSteps.map((step, index) => {
                    const isCompleted = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    return (
                      <div key={step.status} className="flex flex-col items-center relative z-10 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${isCompleted ? "bg-[#C8102E] border-blue-600 text-white" : "bg-white border-[#D4D4D4] text-[#A3A3A3]"} ${isCurrent ? "ring-4 ring-blue-100" : ""}`}>
                          {step.status === "RECIBIDO_EN_DESTINO" ? <CheckCircle className="w-5 h-5" /> : step.status === "RECIBIDO_EN_BODEGA" ? <ClipboardCheck className="w-5 h-5" /> : step.status === "ENVIADO_A_DESTINO" ? <Truck className="w-5 h-5" /> : step.status === "ENVIADO_A_BODEGA" ? <Send className="w-5 h-5" /> : step.status === "EN_RUTA" ? <Truck className="w-5 h-5" /> : step.status === "EN_PARADA" ? <MapPin className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                        </div>
                        <span className={`text-xs mt-2 text-center font-medium ${isCompleted ? "text-[#1A1A1A]" : "text-[#A3A3A3]"}`}>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-[#F0F0F0] -z-0 mx-8">
                  <div className="h-full bg-[#C8102E]" style={{ width: timelineSteps.length > 1 ? (currentStepIndex / (timelineSteps.length - 1)) * 100 : 0 }} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Route */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card><CardContent className="p-4"><p className="text-xs text-[#8A8A8A] mb-1">Origen</p><div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#C8102E]" /><p className="font-medium text-[#1A1A1A]">{shipment.originFranchise?.displayName || "-"}</p></div></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-[#8A8A8A] mb-1">Destino</p><div className="flex items-center gap-2">{(shipment.destinationFranchise?.displayName || "").toLowerCase().includes("recogida") ? (
            <><MapPin className="w-4 h-4 text-orange-600" /><p className="font-bold text-orange-700 bg-orange-50 px-2 py-1 rounded text-sm border border-orange-200">{shipment.destinationFranchise?.displayName || "-"}</p></>
          ) : (
            <><MapPin className="w-4 h-4 text-emerald-600" /><p className="font-medium text-[#1A1A1A]">{shipment.destinationFranchise?.displayName || "-"}</p></>
          )}</div></CardContent></Card>
        </div>

        {/* Timeline */}
        {!isCancelled && (
          <Card>
            <CardHeader><CardTitle className="text-base">Progreso del Envio</CardTitle></CardHeader>
            <CardContent>
              <div className="relative">
                <div className="flex items-center justify-between">
                  {timelineSteps.map((step, index) => {
                    const isCompleted = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    return (
                      <div key={step.status} className="flex flex-col items-center relative z-10 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${isCompleted ? "bg-[#C8102E] border-[#C8102E] text-white" : "bg-white border-[#D4D4D4] text-[#A3A3A3]"} ${isCurrent ? "ring-4 ring-[#C8102E]/20" : ""}`}>
                          {step.status === "RECIBIDO_EN_DESTINO" ? <CheckCircle className="w-5 h-5" /> : step.status === "RECIBIDO_EN_BODEGA" ? <ClipboardCheck className="w-5 h-5" /> : step.status === "ENVIADO_A_DESTINO" ? <Truck className="w-5 h-5" /> : step.status === "ENVIADO_A_BODEGA" ? <Send className="w-5 h-5" /> : step.status === "EN_RUTA" ? <Truck className="w-5 h-5" /> : step.status === "EN_PARADA" ? <MapPin className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                        </div>
                        <span className={`text-xs mt-2 text-center font-medium ${isCompleted ? "text-[#1A1A1A]" : "text-[#A3A3A3]"}`}>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-[#F0F0F0] -z-0 mx-8">
                  <div className="h-full bg-[#C8102E]" style={{ width: timelineSteps.length > 1 ? (currentStepIndex / (timelineSteps.length - 1)) * 100 : 0 }} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tracking History with Actor Names */}
        <Card>
          <CardHeader><CardTitle className="text-base">Historial</CardTitle></CardHeader>
          <CardContent>
            <div className="relative pl-6">
              <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-[#F0F0F0]" />
              <div className="space-y-6">
                {shipment.tracking?.map((track: { id: number; status: string; notes?: string | null; createdAt: Date; actorName?: string | null }, index: number) => {
                  const cfg = getStatusConfig(track.status);
                  return (
                    <div key={track.id} className="relative">
                      <div className={`absolute -left-4 w-3 h-3 rounded-full border-2 ${index === 0 ? "bg-[#C8102E] border-[#C8102E]" : "bg-white border-[#D4D4D4]"}`} />
                      <div className="ml-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className={cfg.color}><cfg.icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
                          <span className="text-xs text-[#A3A3A3]">{track.createdAt ? format(new Date(track.createdAt), "dd/MM/yyyy HH:mm", { locale: es }) : "-"}</span>
                        </div>
                        {track.notes && <p className="text-sm text-[#525252] mt-1">{track.notes}</p>}
                        <p className="text-xs text-[#A3A3A3] mt-1">Por: {track.actorName || "Sistema"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {shipment.notes && <Card><CardContent className="p-4"><p className="text-xs text-[#8A8A8A] mb-1">Notas</p><p className="text-sm text-[#404040]">{shipment.notes}</p></CardContent></Card>}
      </div>
    </FranchiseLayout>
  );
}
