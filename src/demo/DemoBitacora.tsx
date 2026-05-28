import { useSearchParams } from "react-router";
import { getShipmentById, FRANCHISES } from "./data";
import { Truck, Package, MapPin, Printer, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const logoUrl = "/logo.jpg";

export function DemoBitacora() {
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get("ids");
  const ids = idsParam ? idsParam.split(",").map(Number).filter(Boolean) : [];
  const shipments = ids.map(getShipmentById).filter(Boolean) as any[];
  const totalPackages = shipments.reduce((sum, s) => sum + s.items.reduce((a: number, i: any) => a + i.quantity, 0), 0);

  if (shipments.length === 0) return <div className="flex items-center justify-center h-screen text-[#8A8A8A]">No se seleccionaron envios</div>;

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden p-4 bg-slate-100 border-b border-slate-300 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3"><Truck className="w-5 h-5 text-slate-700" /><div><h1 className="text-base font-semibold text-slate-900">Bitacora de Entrega</h1><p className="text-xs text-slate-500">{totalPackages} paquete{totalPackages !== 1 ? "s" : ""}</p></div></div>
        <button onClick={() => window.print()} className="h-10 px-6 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium flex items-center gap-2"><Printer className="w-4 h-4" />Imprimir</button>
      </div>

      <div className="max-w-[900px] mx-auto p-4 print:p-0">
        <div className="border-[3px] border-slate-900 rounded-lg overflow-hidden mb-4">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="AO" className="w-16 h-16 object-contain rounded-lg" />
              <div><h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">American Outlet</h1><p className="text-base font-bold text-slate-500 leading-none mt-1">Bitacora de Entrega</p></div>
            </div>
            <div className="text-right"><p className="text-lg font-mono font-bold text-slate-900">{format(new Date(), "dd/MM/yyyy", { locale: es })}</p></div>
          </div>
        </div>

        <div className="border-[3px] border-slate-900 rounded-lg overflow-hidden mb-4">
          <div className="bg-slate-100 border-b-[3px] border-slate-900 px-4 py-2.5"><p className="text-xs font-black text-slate-900 uppercase tracking-wider">Paquetes ({totalPackages})</p></div>
          <table className="w-full">
            <thead><tr className="border-b-2 border-slate-200">
              <th className="text-left text-[9px] uppercase text-slate-500 font-bold px-4 py-2 w-8">#</th>
              <th className="text-left text-[9px] uppercase text-slate-500 font-bold px-4 py-2">Rastreo</th>
              <th className="text-left text-[9px] uppercase text-slate-500 font-bold px-4 py-2">Remitente</th>
              <th className="text-left text-[9px] uppercase text-slate-500 font-bold px-4 py-2">Articulos</th>
              <th className="text-left text-[9px] uppercase text-slate-500 font-bold px-4 py-2 w-24">Destino</th>
            </tr></thead>
            <tbody>
              {shipments.map((s, idx) => {
                const origin = FRANCHISES.find((f) => f.id === s.originFranchiseId);
                const dest = FRANCHISES.find((f) => f.id === s.destinationFranchiseId);
                return (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5 text-sm font-mono text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-2.5"><p className="text-sm font-mono font-bold text-slate-900">{s.trackingNumber}</p>{s.invoiceNumber && <p className="text-[10px] text-slate-400">Fact: #{s.invoiceNumber}</p>}</td>
                    <td className="px-4 py-2.5"><p className="text-sm font-semibold text-slate-900">{s.senderName}</p><p className="text-[10px] text-slate-500">{s.senderPhone}</p></td>
                    <td className="px-4 py-2.5"><p className="text-sm text-slate-700">{s.items.map((i: any) => `${i.description} x${i.quantity}`).join(", ")}</p></td>
                    <td className="px-4 py-2.5"><p className="text-sm font-semibold text-slate-900">{dest?.displayName || "-"}</p></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border-[3px] border-slate-900 rounded-lg p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-3">Entregue Conforme</p><div className="border-b-2 border-slate-300 h-14 mb-2" /><div className="grid grid-cols-2 gap-2"><div><p className="text-[9px] text-slate-400 uppercase">Nombre</p><div className="border-b border-slate-200 h-5" /></div><div><p className="text-[9px] text-slate-400 uppercase">Fecha y hora</p><div className="border-b border-slate-200 h-5" /></div></div></div>
          <div className="border-[3px] border-slate-900 rounded-lg p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-3">Recibio Conforme</p><div className="border-b-2 border-slate-300 h-14 mb-2" /><div className="grid grid-cols-2 gap-2"><div><p className="text-[9px] text-slate-400 uppercase">Nombre</p><div className="border-b border-slate-200 h-5" /></div><div><p className="text-[9px] text-slate-400 uppercase">Fecha y hora</p><div className="border-b border-slate-200 h-5" /></div></div></div>
        </div>

        <div className="border-[3px] border-slate-900 rounded-lg p-4 mb-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-3">Informacion del Chofer</p>
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-[9px] text-slate-400 uppercase mb-1">Nombre</p><div className="border-b-2 border-slate-300 h-6" /></div>
            <div><p className="text-[9px] text-slate-400 uppercase mb-1">Telefono</p><div className="border-b-2 border-slate-300 h-6" /></div>
            <div><p className="text-[9px] text-slate-400 uppercase mb-1">Placa del vehiculo</p><div className="border-b-2 border-slate-300 h-6" /></div>
          </div>
        </div>

        <div className="border-[3px] border-slate-900 rounded-lg p-4 mb-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Observaciones</p>
          <div className="border-b-2 border-slate-300 h-16" />
        </div>
      </div>
    </div>
  );
}
