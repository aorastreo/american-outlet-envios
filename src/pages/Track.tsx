import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
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
import { buildShipmentTimeline, extractBodegaNames, getCurrentStepIndex } from "../lib/timeline";

function cleanName(name: string | undefined): string {
  if (!name) return "";
  const upper = name.toUpperCase();
  if (upper.includes("GANGA")) return "Ganga Santa Rosa";
  return name.replace(/AMERICAN OUTLET\s*/i, "").trim() || name;
}

function getStatusConfig(status: string) {

    const configs: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    CREADO: { color: "bg-[#F7F7F7] text-[#404040]", label: "Creado", icon: Package },
    ENVIADO_A_BODEGA: { color: "bg-amber-100 text-amber-700", label: "Enviado a Bodega", icon: Send },
    RECIBIDO_EN_BODEGA: { color: "bg-purple-100 text-purple-700", label: "Recibido en Bodega", icon: ClipboardCheck },
    ENVIADO_A_DESTINO: { color: "bg-[#FFF5F5] text-[#C8102E]", label: "Enviado a Destino", icon: Truck },
    EN_RUTA: { color: "bg-blue-100 text-blue-700", label: "En Ruta de Camion", icon: Truck },
    EN_PARADA: { color: "bg-orange-100 text-orange-700", label: "En Punto de Recogida", icon: MapPin },
    NO_RECOGIDO: { color: "bg-red-100 text-red-700", label: "No Recogido", icon: AlertTriangle },
    RECIBIDO_EN_DESTINO: { color: "bg-emerald-100 text-emerald-700", label: "Entregado", icon: CheckCircle },
    CANCELADO: { color: "bg-red-100 text-red-700", label: "Cancelado", icon: AlertTriangle },
    SOLICITADO_RECOLECCION: { color: "bg-amber-100 text-amber-700", label: "Solicitado Recoleccion", icon: Clock },
  RECOLECTADO: { color: "bg-blue-100 text-blue-700", label: "En Transito", icon: Truck },
  ENTREGADO: { color: "bg-emerald-100 text-emerald-700", label: "Entregado", icon: CheckCircle },
};
  return configs[status] || { color: "bg-gray-100 text-gray-500", label: status, icon: Package };
}
export default function Track() {
  const { trackingNumber: urlTrackingNumber } = useParams();
  const [trackingNumber, setTrackingNumber] = useState(urlTrackingNumber || "");
  const [searchedTracking, setSearchedTracking] = useState(urlTrackingNumber || "");
  const isWarrantySearch = searchedTracking.startsWith("G");

  const { data: shipment, isLoading: shipmentLoading, isError: shipmentError } = trpc.shipment.track.useQuery(
    { trackingNumber: searchedTracking },
    { enabled: searchedTracking.length > 0 && !isWarrantySearch, retry: false }
  );

  const { data: warranty, isLoading: warrantyLoading, isError: warrantyError } = trpc.warranty.track.useQuery(
    { trackingNumber: searchedTracking },
    { enabled: searchedTracking.length > 0 && isWarrantySearch, retry: false }
  );

  const isLoading = isWarrantySearch ? warrantyLoading : shipmentLoading;
  const isError = isWarrantySearch ? warrantyError : shipmentError;
  const hasResult = !!shipment || !!warranty;
    useEffect(() => {
    if (urlTrackingNumber) {
      setTrackingNumber(urlTrackingNumber);
      setSearchedTracking(urlTrackingNumber);
    }
  }, [urlTrackingNumber]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingNumber.trim()) {
      setSearchedTracking(trackingNumber.trim().toUpperCase());
    }
  };

    const originIsWarehouse = shipment?.originFranchise?.isWarehouse === 1;
 const destIsWarehouse = (shipment?.destinationFranchise as any)?.isWarehouse === 1;
  // Use isPickupRoute from backend (reliable) or fallback to name detection
  const destName = (shipment?.destinationFranchise?.displayName || shipment?.destinationName || "").toLowerCase();
  const isPickup = (shipment as any)?.isPickupRoute === true ||
    destName.includes("recogida") ||
    ["grecia", "palmares", "san ramon"].some(city => destName.includes(city));

  // Build timeline steps EXACTLY like the admin (ShipmentDetail)
  // Build timeline steps EXACTLY like the admin (ShipmentDetail)
  const trackingHistory = shipment?.tracking || [];
  const whLoc = (shipment as any)?.warehouseLocation;
  const displaySteps = shipment
    ? buildShipmentTimeline(
        isPickup,
        originIsWarehouse,
        destIsWarehouse,
        trackingHistory,
        whLoc,
        shipment.status,
        shipment?.originFranchise?.displayName,
        shipment?.destinationFranchise?.displayName
      )
    : [];
  const mappedStatus = shipment?.status === "ENTREGADO" ? "RECIBIDO_EN_DESTINO" : shipment?.status;
  const currentStepIndex = getCurrentStepIndex(displaySteps, mappedStatus || null, trackingHistory);
  const originFranchiseName = shipment?.originFranchise?.displayName || shipment?.originName || "";
  const destFranchiseName = shipment?.destinationFranchise?.displayName || shipment?.destinationName || "";

  // DEBUG: visible version number + step calculation info
  // DEBUG: visible version number + step calculation info
  const TIMELINE_VERSION = "v3.1-oct3";
  const debugInfo = {
    version: TIMELINE_VERSION,
    status: shipment?.status,
    mappedStatus,
    originIsWarehouse,
    destIsWarehouse,
    isPickup,
    originName: originFranchiseName,
    destName: destFranchiseName,
    steps: displaySteps.map((s, i) => ({ idx: i, status: s.status, label: s.label, active: i === currentStepIndex, completed: i <= currentStepIndex })),
    currentStepIndex,
  };
  console.log("[Track Debug]", debugInfo);

  return (
    <FranchiseLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#C8102E]">RASTREAR ENVIO v3.4-FINAL</h1>
          <p className="text-[#8A8A8A] mt-1">Ingrese el numero de rastreo para ver el estado del envio o garantia</p>
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
              <p className="text-[#404040] font-medium">No se encontro ningun envio o garantia con ese numero</p>
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
              <p className="text-[10px] text-white/60 mt-2 font-mono">{TIMELINE_VERSION}</p>
            </div>

            {/* DEBUG Panel — muestra calculo del timeline */}
            <Card className="bg-yellow-50 border-yellow-300">
              <CardContent className="p-3">
                <p className="text-[10px] font-mono text-yellow-800 leading-tight">
                  <strong>DEBUG {TIMELINE_VERSION}</strong><br/>
                  status={shipment?.status} | mapped={mappedStatus || "null"}<br/>
                  originWH={String(originIsWarehouse)} | destWH={String(destIsWarehouse)} | pickup={String(isPickup)}<br/>
                  origin="{originFranchiseName}" | dest="{destFranchiseName}"<br/>
                  steps={displaySteps.map((s,i) => `${i}:${s.status}${i===currentStepIndex?"*":""}`).join(", ")}<br/>
                  currentStepIndex={currentStepIndex}
                </p>
              </CardContent>
            </Card>

            {/* Direct flow badge */}
            {originIsWarehouse && (
              <Card className="bg-[#FFF5F5] border-[#C8102E]/20">
                <CardContent className="p-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#C8102E]" />
                  <span className="text-sm text-[#C8102E] font-medium">
                    {(() => {
                      const originIsCedi = (shipment?.originFranchise?.name || "").toLowerCase().includes("cedi");
                      const originIsPavon = (shipment?.originFranchise?.name || "").toLowerCase().includes("pavon");
                      const destN = (shipment?.destinationFranchise?.name || "").toLowerCase();
                      const destIsMio = destN.includes("chiles") || destN.includes("pavon") || destN.includes("santa rosa") || destN.includes("ganga");
                      const destIsVendedor = destN.includes("boca arenal") || destN.includes("florencia") || destN.includes("fortuna") || destN.includes("quesada") || destN.includes("puerto viejo");
                      if (destIsWarehouse) return "Envio entre Bodegas";
                      if (originIsCedi && destIsMio) return "Envio desde CEDI (Pasa por Pavon)";
                      if (originIsCedi && destIsVendedor) return "Envio desde CEDI (Directo)";
                      if (originIsPavon && destIsVendedor) return "Envio desde Pavon (Pasa por CEDI)";
                      return "Envio desde Bodega";
                    })()}
                  </span>
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
                      <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />De: {cleanName(shipment.originFranchise?.displayName)}</span>
                      <span className="text-[#D4D4D4]">→</span>
                      <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />Para: {cleanName(shipment.destinationFranchise?.displayName)}</span>
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
                    {displaySteps.map((step, index) => {
                      const isCompleted = index <= currentStepIndex;
                      const isCurrent = index === currentStepIndex;
                      return (
                        <div key={step.status + index} className="flex flex-col items-center relative z-10 flex-1">
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
                  <div className="absolute top-6 left-6 right-6 h-1 bg-[#F0F0F0] -z-0">
                    <div className="h-full bg-[#C8102E] transition-all duration-500" style={{ width: `${displaySteps.length > 1 ? Math.max(0, (currentStepIndex / (displaySteps.length - 1)) * 100) : 0}%` }} />
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

        {/* Warranty Result */}
        {warranty && (
          <div className="space-y-6">
            <div className="bg-[#C8102E] text-white rounded-xl p-6 text-center">
              <p className="text-blue-100 text-sm mb-1">Numero de Garantia</p>
              <p className="text-3xl font-bold font-mono tracking-wider">{warranty.trackingNumber}</p>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-[#737373]">Factura: {warranty.invoiceNumber}</p>
                    <p className="text-lg font-semibold text-[#1A1A1A]">{warranty.senderName}</p>
                    <p className="text-sm text-[#525252]">{warranty.senderPhone}</p>
                  </div>
                  <Badge className={statusConfig[warranty.status]?.color || "bg-gray-100"}>
                    {statusConfig[warranty.status]?.label || warranty.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm"><span className="font-medium">Producto:</span> {warranty.productDescription}</p>
                  <p className="text-sm"><span className="font-medium">Defecto:</span> {warranty.defectDescription}</p>
                  {warranty.notes && <p className="text-sm text-[#737373]">Notas: {warranty.notes}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Warranty Timeline */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-[#1A1A1A] mb-4">Progreso de la Garantia</h3>
                <div className="relative pl-6">
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-[#F0F0F0]" />
                  <div className="space-y-6">
                    {warranty.tracking?.map((track: any, index: number) => {
                      const cfg = getStatusConfig(track.status);
                      return (
                        <div key={track.id} className="relative">
                          <div className={`absolute -left-4 w-3 h-3 rounded-full border-2 ${index === 0 ? "bg-[#C8102E] border-[#C8102E]" : "bg-white border-[#D4D4D4]"}`} />
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
