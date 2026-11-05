import { Link, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import { Truck, Package, Printer } from "lucide-react";
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
  return name.replace(/AMERICAN OUTLET\s*/i, "").replace(/^Recogida\s*-\s*/i, "").trim() || name;
}

export default function Bitacora() {
  const [searchParams] = useSearchParams();
  const { user } = useFranchiseAuth();
  const myFranchiseName = cleanName(user?.franchise?.displayName || user?.franchise?.name);
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
  const when = new Date(generatedAt);
  const origins = [...new Set(shipments.map((s) => cleanName(s.originDisplayName || s.originName)))];
  const destinations = [...new Set(shipments.map((s) => cleanName(s.destinationDisplayName || s.destinationName)))];
  const originName = origins.length === 1 ? origins[0] : "Varios origenes";
  const destinationName = destinations.length === 1 ? destinations[0] : "Varios destinos";
  const brand = isGanga(myFranchiseName) ? "Ganga Santa Rosa" : "American Outlet";

  return (
    <div className="min-h-screen bg-[#F3F3F3] print:min-h-0 print:bg-white">
      <style>{`
        @media print {
          .bitacora-sheet {
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .bitacora-sheet thead { display: table-header-group; }
          .bitacora-sheet tr,
          .bitacora-sign { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="print:hidden p-4 bg-white border-b border-[#D4D4D4] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5 text-[#404040]" />
          <div>
            <h1 className="text-base font-semibold text-[#1A1A1A]">Bitacora</h1>
            <p className="text-xs text-[#404040]">{totalPackages} paquete{totalPackages !== 1 ? "s" : ""}. Asi sale en una hoja.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/envios">Volver al panel</Link>
          </Button>
          <Button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-900">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      <article className="bitacora-sheet max-w-[760px] mx-auto my-6 bg-white text-[#1A1A1A] border border-[#D4D4D4] shadow-sm px-6 py-5 print:my-0">
        <header className="flex items-end justify-between gap-4 border-b-2 border-[#1A1A1A] pb-2">
          <div>
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase">{brand}</p>
            <h2 className="text-xl font-black leading-none mt-1">Bitacora de entrega</h2>
            <p className="text-sm mt-1">
              <span className="font-semibold">{originName}</span>
              <span className="mx-1.5 text-[#737373]">→</span>
              <span className="font-semibold">{destinationName}</span>
            </p>
          </div>
          <div className="text-right text-sm leading-tight">
            <p className="font-mono">{format(when, "dd/MM/yyyy HH:mm", { locale: es })}</p>
            <p className="text-base font-black">{totalPackages} paquete{totalPackages !== 1 ? "s" : ""}</p>
          </div>
        </header>

        <table className="w-full mt-2 border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-[#1A1A1A] text-left">
              <th className="py-1 pr-2 w-6 font-semibold">#</th>
              <th className="py-1 pr-2 font-semibold">Rastreo</th>
              <th className="py-1 pr-2 font-semibold">Factura</th>
              <th className="py-1 pr-2 font-semibold">Remitente</th>
              <th className="py-1 pr-2 font-semibold">Articulos</th>
              <th className="py-1 font-semibold">Destino</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map((shipment, index) => {
              const units = shipment.items?.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0) || 0;
              const articles = shipment.items
                ?.map((item: { description: string; quantity: number }) => `${item.description} x${item.quantity}`)
                .join(", ");
              return (
                <tr key={shipment.id} className="border-b border-[#E5E5E5] align-top">
                  <td className="py-1 pr-2 text-[#525252]">{index + 1}</td>
                  <td className="py-1 pr-2 font-mono font-semibold whitespace-nowrap">{shipment.trackingNumber}</td>
                  <td className="py-1 pr-2 font-mono whitespace-nowrap">{shipment.invoiceNumber || "—"}</td>
                  <td className="py-1 pr-2">
                    <span className="font-medium">{shipment.senderName}</span>
                    {shipment.senderPhone && <span className="text-[#525252]"> · {shipment.senderPhone}</span>}
                  </td>
                  <td className="py-1 pr-2">
                    {articles || "—"}
                    {units > 0 && <span className="text-[#525252]"> ({units})</span>}
                  </td>
                  <td className="py-1 whitespace-nowrap">{cleanName(shipment.destinationDisplayName || shipment.destinationName)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <section className="bitacora-sign mt-5 text-[11px]">
          <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_72px] gap-x-2 gap-y-2 items-end">
            <span className="font-semibold">Entrega</span>
            <span className="border-b border-[#1A1A1A] h-4" />
            <span>Nombre</span>
            <span className="border-b border-[#1A1A1A] h-4" />
            <span>Hora</span>
            <span className="border-b border-[#1A1A1A] h-4" />
            <span className="font-semibold">Recibe</span>
            <span className="border-b border-[#1A1A1A] h-4" />
            <span>Nombre</span>
            <span className="border-b border-[#1A1A1A] h-4" />
            <span>Hora</span>
            <span className="border-b border-[#1A1A1A] h-4" />
            <span className="font-semibold">Chofer</span>
            <span className="border-b border-[#1A1A1A] h-4 col-span-5" />
          </div>
        </section>

        <p className="mt-3 text-[10px] text-[#737373]">{brand} · Manifiesto de salida</p>
      </article>
    </div>
  );
}
