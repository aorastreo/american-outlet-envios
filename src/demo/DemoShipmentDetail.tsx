import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useDemoAuth } from "./useDemoAuth";
import { useDemoShipment, useDemoUpdateStatus } from "./useDemoApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Phone, MapPin, Package, Send, ClipboardCheck, Truck, CheckCircle, Printer, Barcode, Ban } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const statusConfig: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  CREADO: { color: "bg-slate-100 text-[#1A1A1A]", label: "Creado", icon: Package },
  ENVIADO_A_BODEGA: { color: "bg-amber-50 text-[#B8860B]", label: "Enviado a Bodega", icon: Send },
  RECIBIDO_EN_BODEGA: { color: "bg-purple-50 text-purple-700", label: "En Bodega", icon: ClipboardCheck },
  ENVIADO_A_DESTINO: { color: "bg-[#FFF5F5] text-[#C8102E]", label: "Enviado a Destino", icon: Truck },
  RECIBIDO_EN_DESTINO: { color: "bg-emerald-50 text-[#1B6B3E]", label: "Entregado", icon: CheckCircle },
  CANCELADO: { color: "bg-red-50 text-red-700", label: "Cancelado", icon: Ban },
};

const statusActions: Record<string, { next: string; label: string; color: string }> = {
  CREADO: { next: "ENVIADO_A_BODEGA", label: "Marcar como Enviado a Bodega", color: "bg-amber-500 hover:bg-amber-600" },
  ENVIADO_A_BODEGA: { next: "RECIBIDO_EN_BODEGA", label: "Confirmar Recepcion en Bodega", color: "bg-purple-600 hover:bg-purple-700" },
  RECIBIDO_EN_BODEGA: { next: "ENVIADO_A_DESTINO", label: "Marcar como Enviado a Destino", color: "bg-[#C8102E] hover:bg-[#9B0B22]" },
  ENVIADO_A_DESTINO: { next: "RECIBIDO_EN_DESTINO", label: "Confirmar Recepcion en Destino", color: "bg-emerald-600 hover:bg-emerald-700" },
};

export default function DemoShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useDemoAuth();
  const shipment = useDemoShipment(parseInt(id || "0"));
  const { update } = useDemoUpdateStatus();
  const [updating, setUpdating] = useState(false);

  if (!shipment) {
    return <div className="text-center py-12 text-[#8A8A8A]"><Package className="w-12 h-12 mx-auto mb-3 text-[#D4D4D4]" /><p>Envio no encontrado</p><Link to="/envios" className="text-[#C8102E] text-sm hover:underline mt-2 inline-block">Volver a envios</Link></div>;
  }

  const cfg = statusConfig[shipment.status];
  const isCancelled = shipment.status === "CANCELADO";
  const isDelivered = shipment.status === "RECIBIDO_EN_DESTINO";
  const isWarehouse = user?.franchise?.isWarehouse === 1;
  const franchiseId = user?.franchiseId;
  const isOrigin = shipment.originFranchiseId === franchiseId;
  const isDest = shipment.destinationFranchiseId === franchiseId;

  const showAction = !isCancelled && !isDelivered && statusActions[shipment.status] && (
    (shipment.status === "CREADO" && isOrigin) ||
    (shipment.status === "ENVIADO_A_BODEGA" && isWarehouse) ||
    (shipment.status === "RECIBIDO_EN_BODEGA" && isWarehouse) ||
    (shipment.status === "ENVIADO_A_DESTINO" && isDest)
  );

  const handleAction = () => {
    const action = statusActions[shipment.status];
    if (!action) return;
    setUpdating(true);
    update(shipment.id, action.next, action.label.replace("Marcar como ", "").replace("Confirmar ", ""));
    setTimeout(() => { setUpdating(false); window.location.reload(); }, 300);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-[#8A8A8A] hover:text-[#C8102E]"><ArrowLeft className="w-4 h-4" />Volver</button>
        <Button variant="outline" size="sm" onClick={() => window.open(`/boleta/${shipment.id}`, "_blank")}><Printer className="w-4 h-4 mr-1" />Boleta</Button>
      </div>

      <div className="bg-[#C8102E] rounded-xl p-6 text-white text-center">
        <div className="flex items-center justify-center gap-3 mb-1"><Barcode className="w-6 h-6" /><p className="text-3xl font-bold font-mono tracking-wider">{shipment.trackingNumber}</p></div>
        {shipment.invoiceNumber && <p className="text-white/80 text-sm">Factura: #{shipment.invoiceNumber}</p>}
      </div>

      <div className="flex justify-center">{cfg && <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium ${cfg.color}`}><cfg.icon className="w-4 h-4" />{cfg.label}</span>}</div>

      <Card><CardContent className="p-4">
        <p className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wider mb-3">Informacion del Cliente</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-2"><User className="w-4 h-4 text-[#C8102E]" /><div><p className="text-xs text-[#8A8A8A]">Remitente</p><p className="font-medium text-[#1A1A1A]">{shipment.senderName}</p></div></div>
          <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#C8102E]" /><div><p className="text-xs text-[#8A8A8A]">Telefono</p><p className="font-medium text-[#1A1A1A]">{shipment.senderPhone}</p></div></div>
          <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#C8102E]" /><div><p className="text-xs text-[#8A8A8A]">Ubicacion</p><p className="font-medium text-[#1A1A1A]">{(shipment as any).currentLocationName}</p></div></div>
        </div>
        {shipment.receiverName && <div className="mt-3 pt-3 border-t border-[#F0F0F0] flex items-center gap-2"><User className="w-4 h-4 text-emerald-600" /><div><p className="text-xs text-[#8A8A8A]">Recibido por</p><p className="font-medium text-emerald-700">{shipment.receiverName}</p></div></div>}
        <div className="mt-4 pt-4 border-t-2 border-[#F0F0F0]">
          <p className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wider mb-3">Articulos del Envio ({shipment.items.length})</p>
          <div className="space-y-3">
            {shipment.items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-[#F7F7F7] rounded-lg">
                <div><p className="font-medium text-[#1A1A1A]">{item.description}</p>{item.details && <p className="text-sm text-[#8A8A8A]">{item.details}</p>}</div>
                <span className="px-2.5 py-1 bg-[#F0F0F0] rounded-full text-xs font-medium">Cant: {item.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent></Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-[#8A8A8A] mb-1">Origen</p><div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#C8102E]" /><p className="font-medium text-[#1A1A1A]">{(shipment as any).originFranchise?.displayName || "-"}</p></div></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-[#8A8A8A] mb-1">Destino</p><div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-600" /><p className="font-medium text-[#1A1A1A]">{(shipment as any).destinationFranchise?.displayName || "-"}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Historial</CardTitle></CardHeader>
        <CardContent>
          <div className="relative pl-6">
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-[#F0F0F0]" />
            <div className="space-y-5">
              {shipment.tracking.map((track: any, index: number) => {
                const tc = statusConfig[track.status];
                return (
                  <div key={track.id} className="relative">
                    <div className={`absolute -left-4 w-3 h-3 rounded-full border-2 ${index === 0 ? "bg-[#C8102E] border-[#C8102E]" : "bg-white border-[#D4D4D4]"}`} />
                    <div className="ml-4">
                      <div className="flex items-center gap-2 flex-wrap">{tc && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tc.color}`}>{tc.label}</span>}<span className="text-xs text-[#A3A3A3]">{track.createdAt ? format(new Date(track.createdAt), "dd/MM/yyyy HH:mm", { locale: es }) : "-"}</span></div>
                      {track.notes && <p className="text-sm text-[#525252] mt-1">{track.notes}</p>}
                      <p className="text-xs text-[#A3A3A3] mt-0.5">Por: {track.actorName || "Sistema"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {showAction && (
        <div className="flex flex-col gap-3">
          <button onClick={handleAction} disabled={updating} className={`w-full h-12 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 ${statusActions[shipment.status].color}`}>
            {updating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : statusActions[shipment.status].label}
          </button>
        </div>
      )}
    </div>
  );
}
