import { useParams } from "react-router";
import { getShipmentById } from "./data";
import { Printer, ArrowRight, Package, MapPin, Phone, Barcode, Scissors } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const logoUrl = "/logo.jpg";

export function DemoBoleta() {
  const { id } = useParams<{ id: string }>();
  const s = getShipmentById(parseInt(id || "0"));

  if (!s) return <div className="flex items-center justify-center h-screen text-[#8A8A8A]">Envio no encontrado</div>;

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden p-4 bg-slate-100 border-b border-slate-300 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3"><Package className="w-5 h-5 text-slate-700" /><div><h1 className="text-base font-semibold text-slate-900">Boleta de Envio</h1><p className="text-xs text-slate-500">{s.trackingNumber}</p></div></div>
        <button onClick={() => window.print()} className="h-10 px-6 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium flex items-center gap-2"><Printer className="w-4 h-4" />Imprimir</button>
      </div>

      <div className="max-w-[800px] mx-auto p-4 print:p-0">
        <div className="border-[3px] border-slate-900 rounded-lg overflow-hidden">
          <div className="border-b-[3px] border-slate-900 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="AO" className="w-16 h-16 object-contain rounded-lg" />
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">American Outlet</h1>
                <p className="text-base font-bold text-slate-500 leading-none mt-1">Etiqueta de Envio</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-mono font-black text-slate-900 tracking-wider">{s.trackingNumber}</p>
              <p className="text-[10px] text-slate-400">{s.createdAt ? format(new Date(s.createdAt), "dd/MM/yyyy", { locale: es }) : ""}</p>
            </div>
          </div>

          <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
            <div className="bg-slate-100 border-r-[3px] border-slate-900 px-4 flex items-center"><span className="text-sm font-black text-slate-900 uppercase tracking-wider">Nombre</span></div>
            <div className="px-5 py-4"><p className="text-2xl font-bold text-slate-900">{s.senderName}</p></div>
          </div>
          <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
            <div className="bg-slate-100 border-r-[3px] border-slate-900 px-4 flex items-center"><span className="text-sm font-black text-slate-900 uppercase tracking-wider">Telefono</span></div>
            <div className="px-5 py-4"><p className="text-2xl font-bold text-slate-900 font-mono">{s.senderPhone}</p></div>
          </div>
          <div className="grid grid-cols-2 border-b-[3px] border-slate-900">
            <div className="grid grid-cols-[140px_1fr] border-r-[3px] border-slate-900">
              <div className="bg-slate-100 border-r-[3px] border-slate-900 px-4 flex items-center"><span className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3" />Envia</span></div>
              <div className="px-4 py-4"><p className="text-xl font-bold text-slate-900">AO {(s as any).originName?.toUpperCase() || "ORIGEN"}</p></div>
            </div>
            <div className="grid grid-cols-[140px_1fr]">
              <div className="bg-slate-100 border-r-[3px] border-slate-900 px-4 flex items-center"><span className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3" />Destino</span></div>
              <div className="px-4 py-4"><p className="text-xl font-bold text-slate-900">{(s as any).destinationName?.toUpperCase() || "DESTINO"}</p></div>
            </div>
          </div>
          <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
            <div className="bg-slate-100 border-r-[3px] border-slate-900 px-4 flex items-center"><span className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1"><Package className="w-3 h-3" />Articulo</span></div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold text-slate-900">{s.items.map((i: any) => `${i.description} x${i.quantity}`).join(", ")}</p>
              <p className="text-xs text-slate-400">{s.items.reduce((a: number, i: any) => a + i.quantity, 0)} unidad{s.items.length !== 1 ? "es" : ""} total</p>
            </div>
          </div>
          {s.invoiceNumber && (
            <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
              <div className="bg-slate-100 border-r-[3px] border-slate-900 px-4 flex items-center"><span className="text-sm font-black text-slate-900 uppercase tracking-wider"># Factura</span></div>
              <div className="px-5 py-4"><p className="text-3xl font-mono font-black text-slate-900">{s.invoiceNumber}</p></div>
            </div>
          )}
          {s.notes && (
            <div className="grid grid-cols-[140px_1fr] border-b-[3px] border-slate-900">
              <div className="bg-slate-100 border-r-[3px] border-slate-900 px-4 flex items-center"><span className="text-sm font-black text-slate-900 uppercase tracking-wider">Notas</span></div>
              <div className="px-5 py-4"><p className="text-base text-slate-700">{s.notes}</p></div>
            </div>
          )}
          <div className="px-6 py-5">
            <div className="flex items-center gap-5">
              <Barcode className="w-20 h-12 text-slate-800 shrink-0" />
              <div><p className="text-xl font-mono font-black text-slate-900 tracking-wider">{s.trackingNumber}</p><p className="text-[9px] text-slate-400 uppercase tracking-wider">American Outlet - Sistema de Envios</p></div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 border-t-2 border-dashed border-slate-300" /><p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Recorte por aqui</p><div className="flex-1 border-t-2 border-dashed border-slate-300" />
        </div>
      </div>
    </div>
  );
}
