import { useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { Printer, Package, MapPin, Phone, User, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

const logoUrl = "/logo-ganga.jpg";

const COST_MAP: Record<string, number> = {
  PEQUENO: 1000,
  MEDIANO: 3500,
  GRANDE: 6500,
};

const SIZE_LABELS: Record<string, string> = {
  PEQUENO: "Pequeno",
  MEDIANO: "Mediano",
  GRANDE: "Grande",
};

export default function BoletaNacional() {
  const { id } = useParams<{ id: string }>();
  const shipmentId = parseInt(id || "0");

  const { data: shipment, isLoading } = trpc.nationalShipping.getById.useQuery(
    { id: shipmentId },
    { enabled: shipmentId > 0 }
  );

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="flex items-center justify-center h-screen text-[#8A8A8A] text-lg">
        Envio no encontrado
      </div>
    );
  }

  // @ts-ignore - franchiseName added by API
  const franchiseName = (shipment as any).franchiseName || "Tienda";
  const cost = COST_MAP[shipment.packageSize] || 0;
  const sizeLabel = SIZE_LABELS[shipment.packageSize] || shipment.packageSize;

  return (
    <div className="min-h-screen bg-white">
      {/* ===== PRINT BUTTON BAR ===== */}
      <div className="print:hidden p-4 bg-[#F7F7F7] border-b border-[#D4D4D4] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-[#404040]" />
          <div>
            <h1 className="text-base font-semibold text-[#1A1A1A]">Boleta Envio Nacional</h1>
            <p className="text-xs text-[#8A8A8A]">#{shipment.id} {shipment.invoiceNumber && <span>| Fact: {shipment.invoiceNumber}</span>}</p>
          </div>
        </div>
        <Button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-900">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      <div className="max-w-[800px] mx-auto p-4 print:p-0">
        {/* ===== HEADER ===== */}
        <div className="border-[3px] border-slate-900 rounded-lg overflow-hidden">
          <div className="border-b-[3px] border-slate-900 px-6 py-4 flex items-center justify-between bg-white">
            <div className="flex items-center gap-4">
              <img
                src={logoUrl}
                alt="Ganga Santa Rosa"
                className="w-16 h-16 object-contain rounded-lg"
              />
              <div>
                <h1 className="text-2xl font-black text-[#1A1A1A] tracking-tight leading-none">Ganga Santa Rosa</h1>
                <p className="text-base font-bold text-[#404040] leading-none mt-1">Envio Nacional</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#525252] uppercase tracking-wider font-semibold">Fecha</p>
              <p className="text-lg font-mono font-bold text-[#1A1A1A]">
                {shipment.createdAt ? new Date(shipment.createdAt).toLocaleDateString("es-CR") : ""}
              </p>
            </div>
          </div>

          {/* ===== TIENDA ORIGEN ===== */}
          <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
            <div className="bg-[#C8102E] border-r-[3px] border-slate-900 px-4 flex items-center">
              <span className="text-sm font-black text-white uppercase tracking-wider">
                <Store className="w-4 h-4 inline mr-1" /> Envia
              </span>
            </div>
            <div className="px-5 py-4">
              <p className="text-2xl font-bold text-[#C8102E]">{franchiseName}</p>
            </div>
          </div>

          {/* ===== DESTINATARIO ===== */}
          <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
            <div className="bg-[#F7F7F7] border-r-[3px] border-slate-900 px-4 flex items-center">
              <span className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider">
                <User className="w-4 h-4 inline mr-1" /> Destinatario
              </span>
            </div>
            <div className="px-5 py-4">
              <p className="text-2xl font-bold text-[#1A1A1A]">{shipment.receiverName}</p>
            </div>
          </div>

          {/* ===== TELEFONO ===== */}
          <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
            <div className="bg-[#F7F7F7] border-r-[3px] border-slate-900 px-4 flex items-center">
              <span className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider">
                <Phone className="w-4 h-4 inline mr-1" /> Telefono
              </span>
            </div>
            <div className="px-5 py-4">
              <p className="text-2xl font-bold text-[#1A1A1A] font-mono">{shipment.receiverPhone}</p>
            </div>
          </div>

          {/* ===== UBICACION ===== */}
          <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
            <div className="bg-[#F7F7F7] border-r-[3px] border-slate-900 px-4 flex items-start py-4">
              <span className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider">
                <MapPin className="w-4 h-4 inline mr-1" /> Direccion
              </span>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold text-[#1A1A1A]">{shipment.province}, {shipment.canton}, {shipment.district}</p>
              <div className="mt-2 p-3 bg-[#FFF5F5] border border-[#C8102E]/20 rounded-lg">
                <p className="text-base text-[#1A1A1A] font-medium leading-relaxed">{shipment.deliveryAddress}</p>
              </div>
            </div>
          </div>

          {/* ===== CONTENIDO ===== */}
          <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
            <div className="bg-[#F7F7F7] border-r-[3px] border-slate-900 px-4 flex items-center">
              <span className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider">Articulo</span>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold text-[#1A1A1A]">{shipment.description}</p>
              {shipment.invoiceNumber && (
                <span className="inline-block bg-[#C8102E] text-white text-xs font-mono font-bold px-2 py-1 rounded mt-1 tracking-wide">
                  FACT: {shipment.invoiceNumber}
                </span>
              )}
              {shipment.notes && <p className="text-sm text-[#8A8A8A] mt-1">{shipment.notes}</p>}
            </div>
          </div>

          {/* ===== TARIFA Y PAGO ===== */}
          <div className="grid grid-cols-2 border-b-[3px] border-slate-900">
            <div className="grid grid-cols-[140px_1fr] border-r-[3px] border-slate-900">
              <div className="bg-[#F7F7F7] border-r-[3px] border-slate-900 px-4 flex items-center">
                <span className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider">
                  <Package className="w-4 h-4 inline mr-1" /> Tarifa
                </span>
              </div>
              <div className="px-4 py-4 flex items-center">
                <p className="text-xl font-bold text-[#1A1A1A]">{sizeLabel} - &cent;{cost.toLocaleString()}</p>
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr]">
              <div className="bg-[#F7F7F7] border-r-[3px] border-slate-900 px-4 flex items-center">
                <span className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider">Estado</span>
              </div>
              <div className="px-4 py-4 flex items-center">
                <span className="text-lg font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded border border-emerald-200">PAGADO DESDE TIENDA</span>
              </div>
            </div>
          </div>

          {/* ===== FOOTER ===== */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-xs text-[#525252] uppercase tracking-wider font-medium">
                Ganga Santa Rosa - Envios Nacionales
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-mono font-black text-[#1A1A1A] tracking-wider">#{shipment.id}</p>
            </div>
          </div>
        </div>

        {/* ===== CUT LINE ===== */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 border-t-2 border-dashed border-[#D4D4D4]"></div>
          <p className="text-[10px] text-[#525252] uppercase tracking-wider font-medium">Recorte por aqui</p>
          <div className="flex-1 border-t-2 border-dashed border-[#D4D4D4]"></div>
        </div>
      </div>
    </div>
  );
}
