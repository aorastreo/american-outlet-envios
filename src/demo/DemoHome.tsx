import { useState } from "react";
import { Link } from "react-router";
import { getShipmentByTracking, FRANCHISES } from "./data";
import { Search, Package, Truck, Warehouse, CheckCircle, MapPin, Clock, AlertTriangle, Barcode, User, Phone, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const logoUrl = "/logo.jpg";

const statusConfig: Record<string, { color: string; label: string }> = {
  CREADO: { color: "bg-slate-100 text-[#1A1A1A]", label: "Creado" },
  ENVIADO_A_BODEGA: { color: "bg-amber-50 text-[#B8860B]", label: "Enviado a Bodega" },
  RECIBIDO_EN_BODEGA: { color: "bg-purple-50 text-purple-700", label: "En Bodega" },
  ENVIADO_A_DESTINO: { color: "bg-[#FFF5F5] text-[#C8102E]", label: "Enviado a Destino" },
  RECIBIDO_EN_DESTINO: { color: "bg-emerald-50 text-[#1B6B3E]", label: "Entregado" },
  CANCELADO: { color: "bg-red-50 text-red-700", label: "Cancelado" },
};

export default function DemoHome() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [result, setResult] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setNotFound(false);
    setResult(null);
    if (!trackingNumber.trim()) return;
    const s = getShipmentByTracking(trackingNumber.trim());
    if (s) {
      const origin = FRANCHISES.find((f) => f.id === s.originFranchiseId);
      const dest = FRANCHISES.find((f) => f.id === s.destinationFranchiseId);
      setResult({ ...s, originFranchise: origin || null, destinationFranchise: dest || null });
    } else {
      setNotFound(true);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="AO" className="w-11 h-11 rounded-xl object-contain bg-white shadow-sm" />
            <div><h1 className="font-bold text-lg text-[#1A1A1A]">American Outlet</h1><p className="text-[11px] text-[#8A8A8A] uppercase tracking-wider">Sistema de Envios</p></div>
          </div>
          <Link to="/login" className="px-4 py-2.5 border border-[#C8102E] text-[#C8102E] rounded-lg text-sm font-medium hover:bg-[#FFF5F5]">Acceso Franquicias</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FFF5F5] rounded-2xl mb-5"><Barcode className="w-8 h-8 text-[#C8102E]" /></div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1A1A1A] mb-3">Rastree su Envio</h2>
          <p className="text-base text-[#8A8A8A] max-w-xl mx-auto">Ingrese su numero de rastreo para conocer el estado actual de su envio.</p>
        </div>

        <div className="max-w-2xl mx-auto mb-12">
          <form onSubmit={handleSearch} className="flex gap-3 bg-white border border-[#D4D4D4] rounded-xl p-2 shadow-sm">
            <div className="relative flex-1">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A3A3A3]" />
              <input placeholder="Ej: AO84729153X" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())} className="w-full pl-12 h-12 text-lg font-mono tracking-wide border-0 focus:ring-0 outline-none" />
            </div>
            <button type="submit" className="h-12 px-8 bg-[#C8102E] hover:bg-[#9B0B22] text-white rounded-lg font-medium flex items-center gap-2"><Search className="w-5 h-5" />Rastrear</button>
          </form>
        </div>

        {notFound && (
          <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-xl p-8 text-center mb-12">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-[#1A1A1A] font-medium">No se encontro ningun envio con ese numero de rastreo</p>
            <p className="text-sm text-[#8A8A8A] mt-1">Verifique el numero e intente nuevamente</p>
          </div>
        )}

        {result && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-[#C8102E] text-white rounded-xl p-6 text-center"><p className="text-white/80 text-sm mb-1">Numero de Rastreo</p><p className="text-3xl font-bold font-mono tracking-wider">{result.trackingNumber}</p></div>

            <div className="bg-white border border-[#D4D4D4] rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    {result.invoiceNumber && <p className="text-sm text-[#8A8A8A]">Factura: #{result.invoiceNumber}</p>}
                    {(() => { const c = statusConfig[result.status]; return c ? <span className={`px-3 py-1 rounded-full text-xs font-medium ${c.color}`}>{c.label}</span> : null; })()}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-sm text-[#525252]"><span className="flex items-center gap-1"><User className="w-4 h-4 text-[#C8102E]" />{result.senderName}</span><span className="flex items-center gap-1"><Phone className="w-4 h-4 text-[#C8102E]" />{result.senderPhone}</span></div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-[#525252]"><span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-[#C8102E]" />De: {result.originFranchise?.displayName}</span><span>--</span><span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-[#C8102E]" />Para: {result.destinationFranchise?.displayName}</span></div>
                </div>
                <div className="text-right"><p className="text-xs text-[#A3A3A3]"><Calendar className="w-3 h-3 inline mr-1" />{result.createdAt ? format(new Date(result.createdAt), "dd/MM/yyyy HH:mm", { locale: es }) : "-"}</p></div>
              </div>
            </div>

            <div className="bg-white border border-[#D4D4D4] rounded-xl p-6">
              <h3 className="font-semibold text-[#1A1A1A] mb-4">Articulos</h3>
              <div className="space-y-3">
                {result.items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-[#F7F7F7] rounded-lg">
                    <div><p className="font-medium text-[#1A1A1A]">{item.description}</p>{item.details && <p className="text-sm text-[#8A8A8A]">{item.details}</p>}</div>
                    <span className="px-2.5 py-1 bg-[#F0F0F0] rounded-full text-xs font-medium">x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#D4D4D4] rounded-xl p-6">
              <h3 className="font-semibold text-[#1A1A1A] mb-4">Historial</h3>
              <div className="space-y-4">
                {result.tracking.map((track: any) => {
                  const c = statusConfig[track.status];
                  return (
                    <div key={track.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#C8102E] mt-2 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">{c && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.color}`}>{c.label}</span>}<span className="text-xs text-[#A3A3A3]">{track.createdAt ? format(new Date(track.createdAt), "dd/MM HH:mm", { locale: es }) : "-"}</span></div>
                        {track.notes && <p className="text-sm text-[#525252] mt-0.5">{track.notes}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!result && !notFound && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[{ icon: Package, title: "Cree el Envio", desc: "Su tienda registra los articulos y genera el numero de rastreo." }, { icon: Send, title: "Envio a Bodega", desc: "La tienda origen confirma que envio el paquete hacia la bodega." }, { icon: Warehouse, title: "Bodega Central", desc: "La bodega recibe, verifica y reenvia el paquete al destino." }, { icon: CheckCircle, title: "Entregado", desc: "La tienda destino confirma la recepcion y el envio esta completo." }].map((s) => (
              <div key={s.title} className="text-center p-6 border border-[#D4D4D4] rounded-xl hover:border-[#C8102E]/30 transition-colors"><div className="w-12 h-12 bg-[#FFF5F5] rounded-xl flex items-center justify-center mx-auto mb-4"><s.icon className="w-6 h-6 text-[#C8102E]" /></div><h3 className="font-semibold text-[#1A1A1A] mb-2">{s.title}</h3><p className="text-sm text-[#8A8A8A]">{s.desc}</p></div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-[#F0F0F0] mt-12 py-6 text-center text-sm text-[#A3A3A3]"><p>American Outlet - Sistema de Envios y Rastreo entre Franquicias</p></footer>
    </div>
  );
}
