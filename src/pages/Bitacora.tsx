import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { Truck, Package, MapPin, Printer, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function isGanga(name: string | undefined): boolean {
  return (name || "").toLowerCase().includes("ganga");
}

function cleanName(name: string | undefined): string {
  if (!name) return "Tienda";
  const upper = name.toUpperCase();
  if (upper.includes("GANGA")) return "Ganga Santa Rosa";
  return name.replace(/AMERICAN OUTLET\s*/i, "").trim() || name;
}

export default function Bitacora() {
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get("ids");
  const ids = idsParam ? idsParam.split(",").map(Number).filter(Boolean) : [];

  const { data, isLoading } = trpc.shipment.getBitacora.useQuery(
    { ids },
    { enabled: ids.length > 0 }
  );

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!data || data.shipments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-[#8A8A8A] gap-4">
        <Package className="w-12 h-12 text-[#D4D4D4]" />
        <p>No se seleccionaron envios para la bitacora</p>
        <Button onClick={() => window.close()} variant="outline">Cerrar</Button>
      </div>
    );
  }

  const { shipments, totalPackages, generatedAt } = data;

  // Compute common origin and destination
  const origins = [...new Set(shipments.map((s) => s.originFranchiseId))];
  const destinations = [...new Set(shipments.map((s) => s.destinationFranchiseId))];
  const originName = origins.length === 1
    ? cleanName(shipments[0]?.originDisplayName || shipments[0]?.originName)
    : "Multiples origenes";
  const destinationName = destinations.length === 1
    ? cleanName(shipments[0]?.destinationDisplayName || shipments[0]?.destinationName)
    : "Multiples destinos";

  return (
    <div className="min-h-screen bg-white">
      {/* Print button */}
      <div className="print:hidden p-4 bg-[#F7F7F7] border-b border-[#D4D4D4] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5 text-[#404040]" />
          <div>
            <h1 className="text-base font-semibold text-[#1A1A1A]">Bitacora de Entrega</h1>
            <p className="text-xs text-[#404040]">{totalPackages} paquete{totalPackages !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <Button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-900">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      <div className="max-w-[900px] mx-auto p-4 print:p-0">
        {/* === HEADER === */}
        <div className="border-[3px] border-slate-900 rounded-lg overflow-hidden mb-4">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src={isGanga(originName) ? "/logo-ganga.jpg" : "/logo.jpg"}
                alt={isGanga(originName) ? "Ganga Santa Rosa" : "American Outlet"}
                ...
                  {isGanga(originName) ? "Ganga Santa Rosa" : "American Outlet"}
                className="w-16 h-16 object-contain rounded-lg"
              />
              <div>
                <h1 className="text-2xl font-black text-[#1A1A1A] tracking-tight leading-none">
                  {isGanga(originName) ? "Ganga Santa Rosa" : "American Outlet"}
                </h1>
                <p className="text-base font-bold text-[#8A8A8A] leading-none mt-1">Bitacora de Entrega</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#525252] uppercase tracking-wider font-semibold">Fecha</p>
              <p className="text-lg font-mono font-bold text-[#1A1A1A]">
                {format(new Date(generatedAt), "dd/MM/yyyy", { locale: es })}
              </p>
              <p className="text-[10px] text-[#525252] font-semibold">{format(new Date(generatedAt), "HH:mm", { locale: es })}</p>
            </div>
          </div>
        </div>

        {/* === ROUTE INFO === */}
        <div className="grid grid-cols-[1fr_auto_1fr] border-[3px] border-slate-900 rounded-lg overflow-hidden mb-4">
          <div className="px-5 py-3 border-r border-[#F0F0F0]">
            <p className="text-[9px] uppercase tracking-[0.15em] text-[#525252] font-bold mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Origen
            </p>
            <p className="text-lg font-bold text-[#1A1A1A]">{originName}</p>
          </div>
          <div className="flex items-center justify-center px-3">
            <ArrowRight className="w-5 h-5 text-[#A3A3A3]" />
          </div>
          <div className="px-5 py-3 border-l border-[#F0F0F0]">
            <p className="text-[9px] uppercase tracking-[0.15em] text-[#525252] font-bold mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Destino
            </p>
            <p className="text-lg font-bold text-[#1A1A1A]">{destinationName}</p>
          </div>
        </div>

        {/* === SHIPMENTS TABLE === */}
        <div className="border-[3px] border-slate-900 rounded-lg overflow-hidden mb-4">
          <div className="bg-[#F7F7F7] border-b-[3px] border-slate-900 px-4 py-2.5 flex items-center justify-between">
            <p className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider">Paquetes ({totalPackages})</p>
            <p className="text-[10px] text-[#8A8A8A]">{shipments.length} envio{shipments.length !== 1 ? "s" : ""}</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#F0F0F0]">
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-4 py-2 w-8">#</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-4 py-2">Rastreo</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-4 py-2">Remitente</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-4 py-2">Articulos</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-4 py-2 w-24">Destino</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s, idx) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 text-sm font-mono text-[#525252] font-semibold">{idx + 1}</td>
                  <td className="px-4 py-2.5">
                    <p className="text-sm font-mono font-bold text-[#1A1A1A]">{s.trackingNumber}</p>
                    {s.invoiceNumber && (
                      <span className="inline-block bg-[#C8102E] text-white text-xs font-mono font-bold px-2 py-1 rounded mt-1 tracking-wide">
                        FACT: {s.invoiceNumber}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-sm font-semibold text-[#1A1A1A]">{s.senderName}</p>
                    <p className="text-[10px] text-[#525252] font-medium">{s.senderPhone}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-sm text-[#404040]">
                      {s.items?.map((item: { description: string; quantity: number }) => `${item.description} x${item.quantity}`).join(", ")}
                    </p>
                    <p className="text-[10px] text-[#525252] font-medium">
                      {s.items?.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0) || 0} unidad{((s.items?.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0) || 0)) !== 1 ? "es" : ""}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-sm font-semibold text-[#1A1A1A]">
                      {s.destinationDisplayName || s.destinationName || "-"}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* === SIGNATURES === */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Entregue */}
          <div className="border-[3px] border-slate-900 rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#404040] font-bold mb-3">Entregue Conforme</p>
            <div className="border-b-2 border-[#D4D4D4] h-14 mb-2"></div>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#404040]">
              <div>
                <p className="text-[9px] uppercase text-[#525252] font-semibold">Nombre completo</p>
                <div className="border-b border-[#F0F0F0] h-5"></div>
              </div>
              <div>
                <p className="text-[9px] uppercase text-[#525252] font-semibold">Fecha y hora</p>
                <div className="border-b border-[#F0F0F0] h-5"></div>
              </div>
            </div>
          </div>

          {/* Recibio */}
          <div className="border-[3px] border-slate-900 rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#404040] font-bold mb-3">Recibio Conforme</p>
            <div className="border-b-2 border-[#D4D4D4] h-14 mb-2"></div>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#404040]">
              <div>
                <p className="text-[9px] uppercase text-[#525252] font-semibold">Nombre completo</p>
                <div className="border-b border-[#F0F0F0] h-5"></div>
              </div>
              <div>
                <p className="text-[9px] uppercase text-[#525252] font-semibold">Fecha y hora</p>
                <div className="border-b border-[#F0F0F0] h-5"></div>
              </div>
            </div>
          </div>
        </div>

        {/* === CHOFER === */}
        <div className="border-[3px] border-slate-900 rounded-lg p-4 mb-4">
          <p className="text-[10px] uppercase tracking-wider text-[#404040] font-bold mb-3">Informacion del Chofer</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[9px] text-[#525252] uppercase mb-1 font-semibold">Nombre</p>
              <div className="border-b-2 border-[#D4D4D4] h-6"></div>
            </div>
            <div>
              <p className="text-[9px] text-[#525252] uppercase mb-1 font-semibold">Telefono</p>
              <div className="border-b-2 border-[#D4D4D4] h-6"></div>
            </div>
            <div>
              <p className="text-[9px] text-[#525252] uppercase mb-1 font-semibold">Placa del vehiculo</p>
              <div className="border-b-2 border-[#D4D4D4] h-6"></div>
            </div>
          </div>
        </div>

        {/* === OBSERVATIONS === */}
        <div className="border-[3px] border-slate-900 rounded-lg p-4 mb-4">
          <p className="text-[10px] uppercase tracking-wider text-[#404040] font-bold mb-2">Observaciones</p>
          <div className="border-b-2 border-[#D4D4D4] h-16"></div>
        </div>

        {/* === FOOTER === */}
        <div className="flex items-center justify-between text-[10px] text-[#525252] pt-2 border-t border-[#D4D4D4]">
          <p className="font-medium">{isGanga(originName) ? "Ganga Santa Rosa" : "American Outlet"} - Sistema de Envios</p>
          <p className="font-medium">Generada: {format(new Date(generatedAt), "dd/MM/yyyy HH:mm", { locale: es })}</p>
        </div>
      </div>
    </div>
  );
}