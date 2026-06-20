import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { Truck, Package, MapPin, Phone, User, Printer, Store, PenLine } from "lucide-react";
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
  const franchiseName = (data as any).franchiseName || "Tienda";
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

        {/* === TIENDA ORIGEN === */}
        <div className="border-[3px] border-slate-900 rounded-lg overflow-hidden mb-4">
          <div className="bg-[#C8102E] border-b-[3px] border-slate-900 px-4 py-2.5 flex items-center gap-2">
            <Store className="w-4 h-4 text-white" />
            <p className="text-xs font-black text-white uppercase tracking-wider">Tienda Origen: {franchiseName}</p>
          </div>
          <div className="bg-[#F7F7F7] px-4 py-2.5 flex items-center justify-between">
            <p className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider">Total de envios: {shipments.length}</p>
            <p className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider">
              Tarifa total: &cent;{shipments.reduce((sum, s) => sum + (COST_MAP[s.packageSize] || 0), 0).toLocaleString()}
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
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2 w-28">Direccion</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2 w-20">Tarifa</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s, idx) => {
                const cost = COST_MAP[s.packageSize] || 0;
                const sizeLabel = SIZE_LABELS[s.packageSize] || s.packageSize;
                return (
                  <tr key={s.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-3 py-3 text-sm font-mono text-[#525252] font-semibold">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-[#C8102E]" />
                        <span className="text-sm font-semibold text-[#1A1A1A]">{s.receiverName}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3 text-[#8A8A8A]" />
                        <span className="text-xs text-[#525252] font-mono">{s.receiverPhone}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm text-[#404040] font-medium">{s.description}</p>
                      {s.notes && <p className="text-[10px] text-[#8A8A8A] mt-1">{s.notes}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-[#8A8A8A] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-[#525252]">{s.province}</p>
                          <p className="text-xs text-[#525252]">{s.canton}, {s.district}</p>
                        </div>
                      </div>
                      <div className="mt-1.5 p-1.5 bg-[#FFF5F5] border border-[#C8102E]/15 rounded">
                        <p className="text-[10px] text-[#1A1A1A] leading-relaxed">{s.deliveryAddress}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-semibold text-[#1A1A1A]">{sizeLabel}</span>
                      <p className="text-sm font-mono font-bold text-[#C8102E]">&cent;{cost.toLocaleString()}</p>
                      <span className="inline-block mt-1 bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">PAGADO</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* === FIRMA GENERAL === */}
        <div className="border-[3px] border-slate-900 rounded-lg overflow-hidden mb-4">
          <div className="bg-[#F7F7F7] border-b-[3px] border-slate-900 px-4 py-2.5 flex items-center gap-2">
            <PenLine className="w-4 h-4 text-[#404040]" />
            <p className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider">Firma de Confirmacion de Entrega</p>
          </div>
          <div className="px-6 py-6">
            <div className="grid grid-cols-3 gap-8">
              <div>
                <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wider font-semibold mb-2">Nombre del chofer</p>
                <div className="border-b-2 border-[#D4D4D4] h-10"></div>
              </div>
              <div>
                <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wider font-semibold mb-2">Firma</p>
                <div className="border-b-2 border-[#D4D4D4] h-10"></div>
              </div>
              <div>
                <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wider font-semibold mb-2">Fecha y hora</p>
                <div className="border-b-2 border-[#D4D4D4] h-10"></div>
              </div>
            </div>
          </div>
        </div>

        {/* === FOOTER === */}
        <div className="flex items-center justify-between text-[10px] text-[#525252] pt-2 border-t border-[#D4D4D4]">
          <p className="font-medium">American Outlet - Sistema de Envios Nacionales - {franchiseName}</p>
          <p className="font-medium">Generada: {now.toLocaleDateString("es-CR")} {now.toLocaleTimeString("es-CR", {hour: "2-digit", minute: "2-digit"})}</p>
        </div>
      </div>
    </div>
  );
}
