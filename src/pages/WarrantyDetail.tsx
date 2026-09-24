import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShieldCheck, Printer, Package, MapPin, Clock, User, Phone, FileText, ClipboardList } from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  CREADA: { label: "Creada", color: "text-gray-700", bg: "bg-gray-100" },
  ENVIADO_A_CEDI: { label: "Enviado a CEDI", color: "text-blue-700", bg: "bg-blue-50" },
  RECIBIDO_EN_CEDI: { label: "Recibido en CEDI", color: "text-purple-700", bg: "bg-purple-50" },
  EN_REPARACION: { label: "En Reparacion", color: "text-amber-700", bg: "bg-amber-50" },
  REPARADO: { label: "Reparado", color: "text-emerald-700", bg: "bg-emerald-50" },
  ENVIADO_A_TIENDA: { label: "Enviado a Tienda", color: "text-blue-700", bg: "bg-blue-50" },
  RECIBIDO_EN_TIENDA: { label: "Recibido en Tienda", color: "text-purple-700", bg: "bg-purple-50" },
  ENTREGADO_AL_CLIENTE: { label: "Entregado al Cliente", color: "text-green-700", bg: "bg-green-50" },
};

export default function WarrantyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const warrantyId = parseInt(id || "0");

  const { data: warranty, isLoading } = trpc.warranty.getById.useQuery(
    { id: warrantyId },
    { enabled: warrantyId > 0 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8102E]"></div>
      </div>
    );
  }

  if (!warranty) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-[#8A8A8A] text-lg">Garantia no encontrada</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/garantias")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Garantias
        </Button>
      </div>
    );
  }

  const cfg = statusConfig[warranty.status] || statusConfig.CREADA;

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/garantias")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Regresar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Detalle de Garantia</h1>
            <p className="text-sm text-[#737373]">Numero: <span className="font-mono font-medium">{warranty.trackingNumber}</span></p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/boleta-garantia/${warranty.id}`)}>
          <Printer className="w-4 h-4 mr-1" /> Boleta
        </Button>
      </div>

      {/* Main Info Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#C8102E]/10 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-[#C8102E]" />
              </div>
              <div>
                <Badge className={`${cfg.bg} ${cfg.color} border-0`}>
                  {cfg.label}
                </Badge>
                <p className="text-xs text-[#8A8A8A] mt-1">
                  Creada el {new Date(warranty.createdAt).toLocaleDateString("es-CR", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#525252] uppercase tracking-wide flex items-center gap-2">
                <User className="w-4 h-4" /> Cliente
              </h3>
              <div className="bg-[#F7F7F7] rounded-lg p-4 space-y-2">
                <p className="text-sm"><span className="font-medium text-[#1A1A1A]">{warranty.senderName}</span></p>
                <p className="text-sm text-[#525252] flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#C8102E]" /> {warranty.senderPhone}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#525252] uppercase tracking-wide flex items-center gap-2">
                <Package className="w-4 h-4" /> Producto
              </h3>
              <div className="bg-[#F7F7F7] rounded-lg p-4 space-y-2">
                <p className="text-sm"><span className="font-medium text-[#1A1A1A]">{warranty.productDescription}</span></p>
                <p className="text-sm text-[#525252]"><span className="font-medium">Defecto:</span> {warranty.defectDescription}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-[#F7F7F7] rounded-lg p-3">
              <p className="text-xs text-[#8A8A8A]">Factura</p>
              <p className="text-sm font-medium text-[#1A1A1A]">{warranty.invoiceNumber}</p>
            </div>
            <div className="bg-[#F7F7F7] rounded-lg p-3">
              <p className="text-xs text-[#8A8A8A]">Tienda Origen</p>
              <p className="text-sm font-medium text-[#1A1A1A]">{warranty.originFranchise?.name || "-"}</p>
            </div>
            <div className="bg-[#F7F7F7] rounded-lg p-3">
              <p className="text-xs text-[#8A8A8A]">Ubicacion Actual</p>
              <p className="text-sm font-medium text-[#1A1A1A]">{warranty.currentLocation?.name || "-"}</p>
            </div>
          </div>

          {warranty.notes && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> Notas
              </p>
              <p className="text-sm text-amber-800 mt-1">{warranty.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tracking Timeline */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#C8102E]" />
            Bitacora / Historial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pl-6">
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-[#F0F0F0]" />
            <div className="space-y-6">
              {warranty.tracking?.map((track: any, index: number) => {
                const trackCfg = statusConfig[track.status] || statusConfig.CREADA;
                const isLatest = index === 0;
                return (
                  <div key={track.id} className="relative">
                    <div className={`absolute -left-4 w-3 h-3 rounded-full border-2 ${isLatest ? "bg-[#C8102E] border-[#C8102E]" : "bg-white border-[#D4D4D4]"}`} />
                    <div className="ml-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={`${trackCfg.bg} ${trackCfg.color}`}>
                          {trackCfg.label}
                        </Badge>
                        <span className="text-xs text-[#A3A3A3] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {track.createdAt ? new Date(track.createdAt).toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                        </span>
                      </div>
                      {track.notes && <p className="text-sm text-[#525252] mt-1">{track.notes}</p>}
                    </div>
                  </div>
                );
              })}
              {(!warranty.tracking || warranty.tracking.length === 0) && (
                <p className="text-sm text-[#8A8A8A]">No hay registros en la bitacora</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
