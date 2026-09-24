import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, ShieldCheck, MapPin, Phone, User, Package, FileText } from "lucide-react";

const statusConfig: Record<string, { label: string }> = {
  CREADA: { label: "Creada" },
  ENVIADO_A_CEDI: { label: "Enviado a CEDI" },
  RECIBIDO_EN_CEDI: { label: "Recibido en CEDI" },
  EN_REPARACION: { label: "En Reparacion" },
  REPARADO: { label: "Reparado" },
  ENVIADO_A_TIENDA: { label: "Enviado a Tienda" },
  RECIBIDO_EN_TIENDA: { label: "Recibido en Tienda" },
  ENTREGADO_AL_CLIENTE: { label: "Entregado al Cliente" },
};

export default function BoletaGarantia() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const warrantyId = parseInt(id || "0");

  const { data: warranty, isLoading } = trpc.warranty.getById.useQuery(
    { id: warrantyId },
    { enabled: warrantyId > 0 }
  );

  const handlePrint = () => {
    window.print();
  };

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
        <Button variant="outline" className="mt-4 no-print" onClick={() => navigate("/garantias")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver
        </Button>
      </div>
    );
  }

  const cfg = statusConfig[warranty.status] || statusConfig.CREADA;

  return (
    <div className="min-h-screen bg-white">
      {/* Print-hidden controls */}
      <div className="no-print p-4 border-b flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate("/garantias")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Regresar
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-1" /> Imprimir
        </Button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      {/* Boleta content */}
      <div className="max-w-2xl mx-auto p-8 print:p-4">
        {/* Header */}
        <div className="border-b-2 border-[#C8102E] pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-[#C8102E] rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#1A1A1A]">BOLETA DE GARANTIA</h1>
                <p className="text-sm text-[#737373]">American Outlet Costa Rica</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#8A8A8A]">Numero de Garantia</p>
              <p className="text-2xl font-bold font-mono text-[#C8102E]">{warranty.trackingNumber}</p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-[#C8102E]/5 border border-[#C8102E]/20 rounded-lg p-4 mb-6 text-center">
          <p className="text-xs text-[#737373] uppercase tracking-wide">Estado Actual</p>
          <p className="text-lg font-bold text-[#C8102E]">{cfg.label}</p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wide mb-2">Informacion del Cliente</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-[#C8102E] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{warranty.senderName}</p>
                  <p className="text-xs text-[#737373] flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {warranty.senderPhone}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wide mb-2">Detalles</h3>
            <div className="space-y-2">
              <p className="text-sm"><span className="text-[#737373]">Factura:</span> <span className="font-medium">{warranty.invoiceNumber}</span></p>
              <p className="text-sm"><span className="text-[#737373]">Fecha:</span> <span className="font-medium">{new Date(warranty.createdAt).toLocaleDateString("es-CR")}</span></p>
            </div>
          </div>
        </div>

        {/* Product & Defect */}
        <div className="border border-[#F0F0F0] rounded-lg p-4 mb-6">
          <h3 className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wide mb-3">Producto y Defecto</h3>
          <div className="flex items-start gap-2 mb-3">
            <Package className="w-4 h-4 text-[#C8102E] mt-0.5 shrink-0" />
            <p className="text-sm font-medium">{warranty.productDescription}</p>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 font-medium">{warranty.defectDescription}</p>
          </div>
        </div>

        {/* Locations */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#F7F7F7] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-3.5 h-3.5 text-[#C8102E]" />
              <p className="text-xs font-semibold text-[#525252]">Tienda Origen</p>
            </div>
            <p className="text-sm font-medium text-[#1A1A1A]">{warranty.originFranchise?.name || "-"}</p>
          </div>
          <div className="bg-[#F7F7F7] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-3.5 h-3.5 text-[#C8102E]" />
              <p className="text-xs font-semibold text-[#525252]">Ubicacion Actual</p>
            </div>
            <p className="text-sm font-medium text-[#1A1A1A]">{warranty.currentLocation?.name || "-"}</p>
          </div>
        </div>

        {/* Notes */}
        {warranty.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-xs font-semibold text-amber-700 mb-1">Notas</p>
            <p className="text-sm text-amber-800">{warranty.notes}</p>
          </div>
        )}

        {/* Tracking History */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wide mb-3">Historial de Movimientos</h3>
          <div className="space-y-2">
            {warranty.tracking?.map((track: any) => {
              const tCfg = statusConfig[track.status] || statusConfig.CREADA;
              return (
                <div key={track.id} className="flex items-center justify-between border-b border-[#F0F0F0] py-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#C8102E]" />
                    <span className="text-sm font-medium">{tCfg.label}</span>
                  </div>
                  <span className="text-xs text-[#8A8A8A]">
                    {track.createdAt ? new Date(track.createdAt).toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                  </span>
                </div>
              );
            })}
            {(!warranty.tracking || warranty.tracking.length === 0) && (
              <p className="text-sm text-[#8A8A8A]">Sin movimientos registrados</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t pt-4 text-center">
          <p className="text-xs text-[#A3A3A3]">Garantia emitida por American Outlet Costa Rica</p>
          <p className="text-xs text-[#A3A3A3]">Para consultas: garantias@americanoutlet.cr</p>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-8">
          <div>
            <div className="border-b border-[#1A1A1A] pt-8 mb-2"></div>
            <p className="text-xs text-center text-[#737373]">Firma Cliente</p>
          </div>
          <div>
            <div className="border-b border-[#1A1A1A] pt-8 mb-2"></div>
            <p className="text-xs text-center text-[#737373]">Firma Responsable</p>
          </div>
        </div>
      </div>
    </div>
  );
}
