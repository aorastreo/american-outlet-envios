import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { Truck, Package, MapPin, Phone, User, Printer, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

const logoUrl = "/logo.jpg";

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

export default function BitacoraNacional() {
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get("ids");
  const ids = idsParam ? idsParam.split(",").map(Number).filter(Boolean) : [];

  const { data, isLoading } = trpc.nationalShipping.getBitacora.useQuery(
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

  const { shipments, generatedAt } = data;
  const now = new Date(generatedAt);

  return (
    <div className="min-h-screen bg-white">
      {/* Print button */}
      <div className="print:hidden p-4 bg-[#F7F7F7] border-b border-[#D4D4D4] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5 text-[#404040]" />
          <div>
            <h1 className="text-base font-semibold text-[#1A1A1A]">Bitacora de Entrega - Envios Nacionales</h1>
            <p className="text-xs text-[#404040]">{shipments.length} envio{shipments.length !== 1 ? "s" : ""}</p>
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
              <img src={logoUrl} alt="American Outlet" className="w-16 h-16 object-contain rounded-lg" />
              <div>
                <h1 className="text-2xl font-black text-[#1A1A1A] tracking-tight leading-none">American Outlet</h1>
                <p className="text-base font-bold text-[#8A8A8A] leading-none mt-1">Bitacora de Entrega Nacional</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#525252] uppercase tracking-wider font-semibold">Fecha</p>
              <p className="text-lg font-mono font-bold text-[#1A1A1A]">{now.toLocaleDateString("es-CR")}</p>
              <p className="text-[10px] text-[#525252] font-semibold">{now.toLocaleTimeString("es-CR", {hour: "2-digit", minute: "2-digit"})}</p>
            </div>
          </div>
        </div>

        {/* === SUMMARY === */}
        <div className="border-[3px] border-slate-900 rounded-lg overflow-hidden mb-4">
          <div className="bg-[#F7F7F7] border-b-[3px] border-slate-900 px-4 py-2.5 flex items-center justify-between">
            <p className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider">Total de envios: {shipments.length}</p>
            <p className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider">
              Por cobrar: {shipments.filter(s => s.paymentMethod === "COBRA_DESTINO").length}
            </p>
          </div>
        </div>

        {/* === SHIPMENTS TABLE === */}
        <div className="border-[3px] border-slate-900 rounded-lg overflow-hidden mb-4">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-[#F7F7F7]">
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2 w-8">#</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2">Cliente / Telefono</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2">Articulo</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2 w-24">Ubicacion</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2 w-20">Tarifa</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2 w-20">Pago</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2 w-24">Firma</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s, idx) => {
                const cost = COST_MAP[s.packageSize] || 0;
                const sizeLabel = SIZE_LABELS[s.packageSize] || s.packageSize;
                const isPaid = s.paymentMethod === "PAGA_ORIGEN";
                return (
                  <tr key={s.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-3 py-2.5 text-sm font-mono text-[#525252] font-semibold">{idx + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-[#C8102E]" />
                        <span className="text-sm font-semibold text-[#1A1A1A]">{s.receiverName}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-[#8A8A8A]" />
                        <span className="text-xs text-[#525252] font-mono">{s.receiverPhone}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm text-[#404040]">{s.description}</p>
                      {s.notes && <p className="text-[10px] text-[#8A8A8A] mt-0.5">{s.notes}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-[#8A8A8A] mt-0.5 shrink-0" />
                        <span className="text-xs text-[#525252]">{s.province}, {s.canton}, {s.district}</span>
                      </div>
                      <p className="text-[10px] text-[#8A8A8A] mt-0.5 truncate max-w-[120px]">{s.deliveryAddress}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-semibold text-[#1A1A1A]">{sizeLabel}</span>
                      <p className="text-sm font-mono font-bold text-[#C8102E]">&cent;{cost.toLocaleString()}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      {isPaid ? (
                        <span className="inline-block bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded border border-emerald-200">PAGADO</span>
                      ) : (
                        <span className="inline-block bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-1 rounded border border-orange-200">&cent;{cost.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="border-b border-[#D4D4D4] h-10"></div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* === FOOTER === */}
        <div className="flex items-center justify-between text-[10px] text-[#525252] pt-2 border-t border-[#D4D4D4]">
          <p className="font-medium">American Outlet - Sistema de Envios Nacionales</p>
          <p className="font-medium">Generada: {now.toLocaleDateString("es-CR")} {now.toLocaleTimeString("es-CR", {hour: "2-digit", minute: "2-digit"})}</p>
        </div>
      </div>
    </div>
  );
}
