import { useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { Printer, Package, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";

const logoUrl = "/logo.jpg";

export default function Boleta() {
  const { id } = useParams<{ id: string }>();
  const shipmentId = parseInt(id || "0");

  const { data: shipment, isLoading } = trpc.shipment.getBoleta.useQuery(
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
      <div className="flex items-center justify-center h-screen text-[#404040] text-lg">
        Envio no encontrado
      </div>
    );
  }

  const totalItems =
    shipment.items?.reduce(
      (sum: number, item: { quantity: number }) => sum + item.quantity,
      0
    ) || 0;

  const itemsText =
    shipment.items
      ?.map(
        (item: { description: string; quantity: number }) =>
          `${item.description} x${item.quantity}`
      )
      .join(", ") || "";

  return (
    <div className="min-h-screen bg-white">
      {/* ===== PRINT BUTTON BAR ===== */}
      <div className="print:hidden p-4 bg-[#F7F7F7] border-b border-[#D4D4D4] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-[#404040]" />
          <div>
            <h1 className="text-base font-semibold text-[#1A1A1A]">
              Boleta de Envio
            </h1>
            <p className="text-xs text-[#404040]">
              {shipment.trackingNumber}
            </p>
          </div>
        </div>
        <Button
          onClick={handlePrint}
          className="bg-slate-800 hover:bg-slate-900"
        >
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* ===== BOLETA - LANDSCAPE FORM STYLE ===== */}
      <div className="max-w-[800px] mx-auto p-4 print:p-0">
        <div className="border-[3px] border-slate-900 rounded-lg overflow-hidden">
          {/* --- HEADER: Brand + Tracking --- */}
          <div className="border-b-[3px] border-slate-900 px-6 py-4 flex items-center justify-between bg-white">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <img
                src={logoUrl}
                alt="Ganga Outlet Santa Rosa"
                className="w-16 h-16 object-contain rounded-lg"
              />
              <div>
                <h1 className="text-2xl font-black text-[#1A1A1A] tracking-tight leading-none">
                  Ganga Outlet Santa Rosa
                </h1>
                <p className="text-base font-bold text-[#404040] leading-none mt-1">
                  {shipment.originFranchise?.displayName || shipment.originFranchise?.name || "Los Chiles"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#525252] uppercase tracking-wider">
                Rastreo
              </p>
              <p className="text-2xl font-mono font-black text-[#1A1A1A] tracking-wider">
                {shipment.trackingNumber}
              </p>
              <p className="text-[10px] text-[#525252] mt-0.5">
                {shipment.createdAt
                  ? format(new Date(shipment.createdAt), "dd/MM/yyyy", {
                      locale: es,
                    })
                  : ""}
              </p>
            </div>
          </div>

          {/* --- FORM ROWS --- */}
          {/* NOMBRE */}
          <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
            <div className="bg-[#F7F7F7] border-r-[3px] border-slate-900 px-4 flex items-center">
              <span className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider">
                Nombre
              </span>
            </div>
            <div className="px-5 py-4">
              <p className="text-2xl font-bold text-[#1A1A1A]">
                {shipment.senderName}
              </p>
            </div>
          </div>

          {/* TELEFONO */}
          <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
            <div className="bg-[#F7F7F7] border-r-[3px] border-slate-900 px-4 flex items-center">
              <span className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider">
                Telefono
              </span>
            </div>
            <div className="px-5 py-4">
              <p className="text-2xl font-bold text-[#1A1A1A] font-mono">
                {shipment.senderPhone}
              </p>
            </div>
          </div>

          {/* ENVIA / DESTINO - side by side */}
          <div className="grid grid-cols-2 border-b-[3px] border-slate-900">
            {/* ENVIA */}
            <div className="grid grid-cols-[140px_1fr] border-r-[3px] border-slate-900">
              <div className="bg-[#F7F7F7] border-r-[3px] border-slate-900 px-4 flex items-center">
                <span className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider">
                  Envia
                </span>
              </div>
              <div className="px-4 py-4 flex items-center">
                <p className="text-xl font-bold text-[#1A1A1A]">
                  AO{" "}
                  {(shipment.originFranchise?.displayName || shipment.originFranchise?.name || "LOS CHILES")
                    .toUpperCase()}
                </p>
              </div>
            </div>
            {/* DESTINO */}
            <div className="grid grid-cols-[140px_1fr]">
              <div className="bg-[#F7F7F7] border-r-[3px] border-slate-900 px-4 flex items-center">
                <span className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider">
                  Destino
                </span>
              </div>
              <div className="px-4 py-4 flex items-center">
                <p className="text-xl font-bold text-[#1A1A1A]">
                  {(shipment.destinationFranchise?.displayName || shipment.destinationFranchise?.name || "")
                    .toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          {/* DESCRIPCION DE ARTICULO */}
          <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
            <div className="bg-[#F7F7F7] border-r-[3px] border-slate-900 px-4 flex items-center">
              <span className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider">
                Articulo
              </span>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold text-[#1A1A1A]">
                {itemsText}
              </p>
              <p className="text-xs text-[#525252] mt-1">
                {totalItems} unidad{totalItems !== 1 ? "es" : ""} total
              </p>
            </div>
          </div>

          {/* # FACTURA */}
          {shipment.invoiceNumber && (
            <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
              <div className="bg-[#F7F7F7] border-r-[3px] border-slate-900 px-4 flex items-center">
                <span className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider">
                  # Factura
                </span>
              </div>
              <div className="px-5 py-4">
                <p className="text-3xl font-mono font-black text-[#1A1A1A]">
                  {shipment.invoiceNumber}
                </p>
              </div>
            </div>
          )}

          {/* NOTAS */}
          {shipment.notes && (
            <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
              <div className="bg-[#F7F7F7] border-r-[3px] border-slate-900 px-4 flex items-center">
                <span className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider">
                  Notas
                </span>
              </div>
              <div className="px-5 py-4">
                <p className="text-base text-[#404040]">{shipment.notes}</p>
              </div>
            </div>
          )}

          {/* --- FOOTER / BARCODE --- */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ArrowRight className="w-5 h-5 text-[#525252]" />
              <p className="text-xs text-[#525252] uppercase tracking-wider">
                {shipment.originFranchise?.displayName || shipment.originFranchise?.name || ""}
                {" "}
                <span className="text-[#D4D4D4]">-</span>
                {" "}
                {shipment.destinationFranchise?.displayName || shipment.destinationFranchise?.name || ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-mono font-black text-[#1A1A1A] tracking-wider">
                {shipment.trackingNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Cut line */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 border-t-2 border-dashed border-[#D4D4D4]"></div>
          <p className="text-[10px] text-[#525252] uppercase tracking-wider font-medium">
            Recorte por aqui
          </p>
          <div className="flex-1 border-t-2 border-dashed border-[#D4D4D4]"></div>
        </div>
      </div>
    </div>
  );
}
