import { useState, useMemo } from "react";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search, Package, Truck, CheckCircle,
  MapPin, Clock, AlertTriangle, User, Phone, Barcode,
  Send, ClipboardCheck, Zap,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
  function getStatusConfig(status: string) {
    const configs: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    CREADO: { color: "bg-[#F7F7F7] text-[#404040]", label: "Creado", icon: Package },
    ENVIADO_A_BODEGA: { color: "bg-amber-100 text-amber-700", label: "Enviado a Bodega", icon: Send },
    RECIBIDO_EN_BODEGA: { color: "bg-purple-100 text-purple-700", label: "Recibido en Bodega", icon: ClipboardCheck },
    ENVIADO_A_DESTINO: { color: "bg-[#FFF5F5] text-[#C8102E]", label: "Enviado a Destino", icon: Truck },
    EN_RUTA: { color: "bg-blue-100 text-blue-700", label: "En Ruta de Camion", icon: Truck },
    EN_PARADA: { color: "bg-orange-100 text-orange-700", label: "En Punto de Recogida", icon: MapPin },
    RECIBIDO_EN_DESTINO: { color: "bg-emerald-100 text-emerald-700", label: "Entregado", icon: CheckCircle },
    CANCELADO: { color: "bg-red-100 text-red-700", label: "Cancelado", icon: AlertTriangle },
    SOLICITADO_RECOLECCION: { color: "bg-amber-100 text-amber-700", label: "Solicitado Recoleccion", icon: Clock },
  RECOLECTADO: { color: "bg-blue-100 text-blue-700", label: "En Transito", icon: Truck },
  ENTREGADO: { color: "bg-emerald-100 text-emerald-700", label: "Entregado", icon: CheckCircle },
};
  return configs[status] || { color: "bg-gray-100 text-gray-500", label: status, icon: Package };
}

// Timeline para envios a TIENDAS NORMALES (sin EN_RUTA ni EN_PARADA)
const storeTimeline = [
  { status: "CREADO", label: "Creado", desc: "Envio registrado" },
  { status: "ENVIADO_A_BODEGA", label: "Enviado a Bodega", desc: "Tienda envio a bodega" },
  { status: "RECIBIDO_EN_BODEGA", label: "En Bodega", desc: "Bodega recibio" },
  { status: "ENVIADO_A_DESTINO", label: "Enviado a Destino", desc: "Bodega envio a tienda" },
  { status: "RECIBIDO_EN_DESTINO", label: "Entregado", desc: "Cliente recibio" },
];

// Timeline para envios a PUNTOS DE RECOGIDA (con EN_RUTA y EN_PARADA)
const pickupTimeline = [
  { status: "CREADO", label: "Creado", desc: "Envio registrado" },
  { status: "ENVIADO_A_BODEGA", label: "Enviado a Bodega", desc: "Tienda envio a bodega" },
  { status: "RECIBIDO_EN_BODEGA", label: "En Bodega", desc: "Bodega recibio" },
  { status: "EN_RUTA", label: "En Ruta", desc: "Asignado a camion" },
  { status: "EN_PARADA", label: "En Parada", desc: "Camion en punto de recogida" },
  { status: "RECIBIDO_EN_DESTINO", label: "Entregado", desc: "Cliente recibio" },
];

// Timeline para envio DIRECTO de bodega a PUNTO DE RECOGIDA
const directPickupTimeline = [
  { status: "CREADO", label: "Creado", desc: "Envio registrado" },
  { status: "ENVIADO_A_DESTINO", label: "Enviado a Destino", desc: "Bodega envio directo" },
  { status: "EN_RUTA", label: "En Ruta", desc: "Asignado a camion" },
  { status: "EN_PARADA", label: "En Parada", desc: "Camion en punto de recogida" },
  { status: "RECIBIDO_EN_DESTINO", label: "Entregado", desc: "Cliente recibio" },
];

// Timeline para envio DIRECTO de bodega a TIENDA
const directStoreTimeline = [
  { status: "CREADO", label: "Creado", desc: "Envio registrado" },
  { status: "ENVIADO_A_DESTINO", label: "Enviado a Destino", desc: "Bodega envio a tienda" },
  { status: "RECIBIDO_EN_DESTINO", label: "Entregado", desc: "Cliente recibio" },
];

export default function Track() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [searchedTracking, setSearchedTracking] = useState("");

  const { data: shipment, isLoading, isError } = trpc.shipment.track.useQuery(
    { trackingNumber: searchedTracking },
    { enabled: searchedTracking.length > 0, retry: false }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingNumber.trim()) {
      setSearchedTracking(trackingNumber.trim().toUpperCase());
    }
  };

  // Ultra simple: is this a pickup point? Grecia=5, SanRamon=6, Palmares=7
  const destId = shipment?.destinationFranchiseId;
  const isPickup = destId === 5 || destId === 6 || destId === 7;

  const originIsWarehouse = useMemo(() => {
    return shipment?.originFranchise?.isWarehouse === 1;
  }, [shipment]);

  // Pickup = route timeline, Store = store timeline
   const timelineSteps = isPickup
    ? (originIsWarehouse ? directPickupTimeline : pickupTimeline)
    : (originIsWarehouse ? directStoreTimeline : storeTimeline);

  const currentStepIndex = shipment ? timelineSteps.findIndex((s) => s.status === shipment.status) : -1;

  return (
    <FranchiseLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Rastrear Envio</h1>
          <p className="text-[#8A8A8A] mt-1">Ingrese el numero de rastreo para ver el estado del envio</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A3A3A3]" />
                <Input
                  placeholder="Ej: AO84729153X"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
                  className="pl-12 h-12 text-lg font-mono"
                />
              </div>
              <Button type="submit" className="h-12 px-8 bg-[#C8102E] hover:bg-[#9B0B22]" disabled={isLoading || !trackingNumber.trim()}>
                {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Search className="w-5 h-5 mr-2" />Rastrear</>}
              </Button>
            </form>
          </CardContent>
        </Card>

        {isError && (
          <Card className="border-red-200">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-[#404040] font-medium">No se encontro ningun envio con ese numero de rastreo</p>
              <p className="text-sm text-[#8A8A8A] mt-1">Verifique el numero e intente nuevamente</p>
            </CardContent>
          </Card>
        )}

        {shipment && (
          <div className="space-y-6">
            {/* Tracking Banner */}
            <div className="bg-[#C8102E] text-white rounded-xl p-6 text-center">
              <p className="text-blue-100 text-sm mb-1">Numero de Rastreo</p>
              <p className="text-3xl font-bold font-mono tracking-wider">{shipment.trackingNumber}</p>
            </div>

            {/* Direct flow badge */}
            {originIsWarehouse && (
              <Card className="bg-[#FFF5F5] border-[#C8102E]/20">
                <CardContent className="p-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#C8102E]" />
                  <span className="text-sm text-[#C8102E] font-medium">Envio Directo desde Bodega - Flujo acelerado (Bodega → Tienda)</span>
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            <Card className="border-[#C8102E]/20">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      {shipment.invoiceNumber && <p className="text-sm text-[#8A8A8A]">Factura: #{shipment.invoiceNumber}</p>}
                      {(() => {
                        const cfg = getStatusConfig(shipment.status);
                        return cfg ? <Badge variant="secondary" className={cfg.color}><cfg.icon className="w-3 h-3 mr-1" />{cfg.label}</Badge> : null;
                      })()}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-[#525252] flex-wrap">
                      <span className="flex items-center gap-1"><User className="w-4 h-4" />{shipment.senderName}</span>
                      <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{shipment.senderPhone}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-[#525252] flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />De: {shipment.originFranchise?.displayName}</span>
                      <span>→</span>
                       <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />Para: {shipment.destinationFranchise?.displayName}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#A3A3A3]"><Clock className="w-3 h-3 inline mr-1" />{shipment.createdAt ? format(new Date(shipment.createdAt), "dd/MM/yyyy HH:mm", { locale: es }) : "-"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-[#1A1A1A] mb-6">Progreso del Envio</h3>
                <div className="relative">
                  <div className="flex items-center justify-between">
                    {timelineSteps.map((step, index) => {
                      const isCompleted = index <= currentStepIndex;
                      const isCurrent = index === currentStepIndex;
                      return (
                        <div key={step.status} className="flex flex-col items-center relative z-10 flex-1">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${isCompleted ? "bg-[#C8102E] border-blue-600 text-white" : "bg-white border-[#D4D4D4] text-[#A3A3A3]"} ${isCurrent ? "ring-4 ring-blue-100" : ""}`}>
                            {step.status === "RECIBIDO_EN_DESTINO" ? <CheckCircle className="w-6 h-6" /> :
                             step.status === "RECIBIDO_EN_BODEGA" ? <ClipboardCheck className="w-6 h-6" /> :
                             step.status === "CREADO" ? <Package className="w-6 h-6" /> :
                             <Truck className="w-6 h-6" />}
                          </div>
                          <span className={`text-xs mt-3 text-center font-medium ${isCompleted ? "text-[#1A1A1A]" : "text-[#A3A3A3]"}`}>{step.label}</span>
                          <span className={`text-[10px] text-center ${isCompleted ? "text-[#8A8A8A]" : "text-[#A3A3A3]"}`}>{step.desc}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="absolute top-6 left-0 right-0 h-1 bg-[#F0F0F0] -z-0 mx-8">
                    <div className="h-full bg-[#C8102E] transition-all duration-500" style={{ width: `${Math.max(0, (currentStepIndex / (timelineSteps.length - 1)) * 100)}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>

                                    {/* Items */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-[#1A1A1A] mb-4">Articulos ({shipment.items?.length || 0})</h3>
                <div className="space-y-3">
                  {shipment.items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-[#F7F7F7] rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-[#1A1A1A]">{item.description}</p>
                        {item.details && <p className="text-sm text-[#8A8A8A]">{item.details}</p>}
                      </div>
                      <Badge variant="secondary">Cant: {item.quantity}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* History */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-[#1A1A1A] mb-4">Historial</h3>
                <div className="relative pl-6">
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-[#F0F0F0]" />
                  <div className="space-y-6">
                    {shipment.tracking?.map((track, index) => {
                      const cfg = getStatusConfig(track.status);
                      return (
                        <div key={track.id} className="relative">
                          <div className={`absolute -left-4 w-3 h-3 rounded-full border-2 ${index === 0 ? "bg-[#C8102E] border-blue-600" : "bg-white border-[#D4D4D4]"}`} />
                          <div className="ml-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              {cfg && <Badge variant="secondary" className={cfg.color}><cfg.icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>}
                              <span className="text-xs text-[#A3A3A3]">{track.createdAt ? format(new Date(track.createdAt), "dd/MM/yyyy HH:mm", { locale: es }) : "-"}</span>
                            </div>
                            {track.notes && <p className="text-sm text-[#525252] mt-1">{track.notes}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </FranchiseLayout>
  );
}
// Force rebuild Wed Jun  3 05:46:45 CST 2026
