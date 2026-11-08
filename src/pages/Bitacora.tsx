import { Link, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { Truck, Package, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function cleanName(name: string | undefined): string {
  if (!name) return "Tienda";
  return name.replace(/AMERICAN OUTLET\s*/i, "").replace(/^Recogida\s*-\s*/i, "").trim() || name;
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

  if (ids.length === 0 || !data || data.shipments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-[#8A8A8A] gap-4 px-6 text-center">
        <Package className="w-12 h-12 text-[#D4D4D4]" />
        <p>
          {ids.length === 0
            ? "No se seleccionaron envios para la bitacora"
            : "No se pudieron cargar esos envios. Abra la bitacora desde Bitacoras en Envios o vuelva a marcar los paquetes."}
        </p>
        <Button asChild variant="outline">
          <Link to="/envios">Volver al panel</Link>
        </Button>
      </div>
    );
  }

  const { shipments, totalPackages, generatedAt } = data;
  const when = new Date(generatedAt);
  const origins = [...new Set(shipments.map((s) => cleanName(s.originDisplayName || s.originName)))];
  const destinations = [...new Set(shipments.map((s) => cleanName(s.destinationDisplayName || s.destinationName)))];
  const originName = origins.length === 1 ? origins[0] : "Varios origenes";
  const destinationName = destinations.length === 1 ? destinations[0] : "Varios destinos";
  const brand = "American Outlet";
  const logoUrl = "/logo.jpg";

  return (
    <div className="min-h-screen bg-[#F3F3F3] print:min-h-0 print:bg-white">
      <style>{`
        .bitacora-sheet {
          min-height: calc(11in - 16mm);
          display: flex;
          flex-direction: column;
        }
        .bitacora-main { flex: 1 1 auto; }
        .bitacora-sign { margin-top: auto; }
        @media print {
          .bitacora-sheet {
            min-height: 0 !important;
            display: block !important;
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .bitacora-sheet thead { display: table-header-group; }
          .bitacora-sheet tr { break-inside: avoid; page-break-inside: avoid; }
          .bitacora-sign {
            position: static !important;
            display: grid !important;
            visibility: visible !important;
            margin-top: 14mm;
            break-inside: avoid;
            page-break-inside: avoid;
            background: #fff;
          }
          .bitacora-sign .sign-line { margin-top: 14mm; }
          .bitacora-head, .bitacora-sheet thead {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="print:hidden p-4 bg-white border-b border-[#D4D4D4] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5 text-[#404040]" />
          <div>
            <h1 className="text-base font-semibold text-[#1A1A1A]">Bitacora</h1>
            <p className="text-xs text-[#404040]">{totalPackages} paquete{totalPackages !== 1 ? "s" : ""}. Las firmas quedan al pie de la hoja.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/envios">Volver al panel</Link>
          </Button>
          <Button onClick={handlePrint} className="bg-[#C8102E] hover:bg-[#9B0B22]">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      <article className="bitacora-sheet max-w-[760px] mx-auto my-6 bg-white text-[#1A1A1A] border border-[#D4D4D4] shadow-sm print:my-0">
        <header className="bitacora-head bg-[#C8102E] text-white px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoUrl}
              alt={brand}
              className="w-12 h-12 object-contain bg-white rounded-md shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/80">{brand}</p>
              <h2 className="text-lg font-black leading-none mt-0.5">Bitacora de entrega</h2>
              <p className="text-sm mt-1 truncate">
                <span className="font-semibold">{originName}</span>
                <span className="mx-1.5 text-white/70">→</span>
                <span className="font-semibold">{destinationName}</span>
              </p>
            </div>
          </div>
          <div className="text-right text-sm leading-tight shrink-0">
            <p className="font-mono">{format(when, "dd/MM/yyyy HH:mm", { locale: es })}</p>
            <p className="text-base font-black">{totalPackages} paquete{totalPackages !== 1 ? "s" : ""}</p>
          </div>
        </header>

        <div className="bitacora-main px-4">
        <table className="w-full mt-2 border-collapse text-[12px]">
          <thead>
            <tr className="border-b-2 border-[#C8102E] text-left text-[#9B0B22]">
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

        </div>
        <section className="bitacora-sign px-4 pb-5 pt-4 grid grid-cols-3 gap-10 text-xs">
          {["Entrega", "Recibe", "Chofer"].map((label) => (
            <div key={label}>
              <p className="font-semibold text-[#C8102E]">{label}</p>
              <div className="sign-line mt-8 border-b border-[#1A1A1A]" />
            </div>
          ))}
        </section>
      </article>
    </div>
  );
}
