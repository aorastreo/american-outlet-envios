import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { ShieldCheck, Printer, Store, Package, User, Phone, FileText, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

const statusConfig: Record<string, { label: string }> = {
  CREADA: { label: "Creada" },
  ENVIADO_A_CEDI: { label: "Enviado a CEDI" },
  RECIBIDO_EN_CEDI: { label: "Recibido en CEDI" },
  EN_REPARACION: { label: "En Reparacion" },
  REPARADO: { label: "Reparado" },
  NO_REPARABLE: { label: "No Reparable" },
  ENVIADO_A_TIENDA: { label: "Enviado a Tienda" },
  RECIBIDO_EN_TIENDA: { label: "Recibido en Tienda" },
  ENTREGADO_AL_CLIENTE: { label: "Entregado al Cliente" },
};

export default function BitacoraGarantia() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get("ids");
  const ids = idsParam ? idsParam.split(",").map(Number).filter(Boolean) : [];

  const { data, isLoading } = trpc.warranty.getBitacora.useQuery(
    { ids },
    { enabled: ids.length > 0 }
  );

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8102E]"></div>
      </div>
    );
  }

  if (!data || data.warranties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-[#8A8A8A] gap-4">
        <AlertTriangle className="w-12 h-12 text-[#D4D4D4]" />
        <p>No se seleccionaron garantias para la bitacora</p>
        <Button onClick={() => navigate("/garantias")} variant="outline">Volver a Garantias</Button>
      </div>
    );
  }

  const { warranties, generatedAt, franchiseName } = data;
  const now = new Date(generatedAt);

  return (
    <div className="min-h-screen bg-white">
      {/* Print button */}
      <div className="print:hidden p-4 bg-[#F7F7F7] border-b border-[#D4D4D4] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/garantias")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Regresar
          </Button>
          <div>
            <h1 className="text-base font-semibold text-[#1A1A1A]">Bitacora de Garantias</h1>
            <p className="text-xs text-[#404040]">{warranties.length} garantia{warranties.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <Button onClick={handlePrint} className="bg-[#C8102E] hover:bg-[#A50D25]">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      <div className="max-w-[900px] mx-auto p-4 print:p-0">
        {/* === HEADER === */}
        <div className="border-[3px] border-[#C8102E] rounded-lg overflow-hidden mb-4">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-[#C8102E] rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[#1A1A1A] tracking-tight leading-none">American Outlet</h1>
                <p className="text-base font-bold text-[#8A8A8A] leading-none mt-1">Bitacora de Garantias</p>
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
        <div className="border-[3px] border-[#C8102E] rounded-lg overflow-hidden mb-4">
          <div className="bg-[#C8102E] border-b-[3px] border-[#C8102E] px-4 py-2.5 flex items-center gap-2">
            <Store className="w-4 h-4 text-white" />
            <p className="text-xs font-black text-white uppercase tracking-wider">Tienda: {franchiseName}</p>
          </div>
          <div className="bg-[#F7F7F7] px-4 py-2.5 flex items-center justify-between">
            <p className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider">Total de garantias: {warranties.length}</p>
          </div>
        </div>

        {/* === WARRANTIES TABLE === */}
        <div className="border-[3px] border-[#C8102E] rounded-lg overflow-hidden mb-4">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#C8102E] bg-[#F7F7F7]">
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2 w-8">#</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2">Guia</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2">Cliente / Telefono</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2">Producto</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2">Defecto</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2 w-20">Factura</th>
                <th className="text-left text-[9px] uppercase tracking-wider text-[#404040] font-bold px-3 py-2 w-24">Estado</th>
              </tr>
            </thead>
            <tbody>
              {warranties.map((w, idx) => {
                const cfg = statusConfig[w.status] || statusConfig.CREADA;
                return (
                  <tr key={w.id} className="border-b border-[#C8102E]/20 last:border-0">
                    <td className="px-3 py-3 text-sm font-mono text-[#525252] font-semibold">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-mono font-bold text-[#C8102E]">{w.trackingNumber}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-[#C8102E]" />
                        <span className="text-sm font-semibold text-[#1A1A1A]">{w.senderName}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3 text-[#8A8A8A]" />
                        <span className="text-xs text-[#525252] font-mono">{w.senderPhone}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-1">
                        <Package className="w-3 h-3 text-[#8A8A8A] mt-0.5 shrink-0" />
                        <p className="text-sm text-[#404040] font-medium">{w.productDescription}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-1">
                        <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-red-700 font-medium">{w.defectDescription}</p>
                      </div>
                      {w.notes && <p className="text-[10px] text-[#8A8A8A] mt-1">{w.notes}</p>}
                    </td>
                    <td className="px-3 py-3">
                      {w.invoiceNumber ? (
                        <span className="text-xs font-mono font-bold text-[#C8102E]">{w.invoiceNumber}</span>
                      ) : (
                        <span className="text-[10px] text-[#A3A3A3]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-block bg-[#C8102E]/10 text-[#C8102E] text-[9px] font-bold px-1.5 py-0.5 rounded">
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* === FIRMA GENERAL === */}
        <div className="border-[3px] border-[#C8102E] rounded-lg overflow-hidden mb-4">
          <div className="bg-[#F7F7F7] border-b-[3px] border-[#C8102E] px-4 py-2.5 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#404040]" />
            <p className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider">Confirmacion de Garantias</p>
          </div>
          <div className="px-4 py-6">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="border-b-2 border-[#1A1A1A] pt-8 mb-2"></div>
                <p className="text-xs text-center text-[#737373]">Firma Responsable</p>
                <p className="text-[10px] text-center text-[#A3A3A3] mt-0.5">Nombre: _________________________</p>
              </div>
              <div>
                <div className="border-b-2 border-[#1A1A1A] pt-8 mb-2"></div>
                <p className="text-xs text-center text-[#737373]">Firma CEDI / Tecnico</p>
                <p className="text-[10px] text-center text-[#A3A3A3] mt-0.5">Nombre: _________________________</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-4">
          <p className="text-[10px] text-[#A3A3A3]">American Outlet Costa Rica - Sistema de Garantias</p>
        </div>
      </div>
    </div>
  );
}
