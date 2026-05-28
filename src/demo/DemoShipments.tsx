import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { useDemoAuth } from "./useDemoAuth";
import { useDemoList } from "./useDemoApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Package, Search, ArrowRight, User, Send, ClipboardCheck, Truck, CheckCircle, Store, Filter, X, Printer, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const statusConfig: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  CREADO: { color: "bg-slate-100 text-[#1A1A1A]", label: "Creado", icon: Package },
  ENVIADO_A_BODEGA: { color: "bg-amber-50 text-[#B8860B]", label: "Enviado a Bodega", icon: Send },
  RECIBIDO_EN_BODEGA: { color: "bg-purple-50 text-purple-700", label: "En Bodega", icon: ClipboardCheck },
  ENVIADO_A_DESTINO: { color: "bg-[#FFF5F5] text-[#C8102E]", label: "Enviado a Destino", icon: Truck },
  RECIBIDO_EN_DESTINO: { color: "bg-emerald-50 text-[#1B6B3E]", label: "Entregado", icon: CheckCircle },
  CANCELADO: { color: "bg-red-50 text-red-700", label: "Cancelado", icon: Package },
};

export default function DemoShipments() {
  const [searchParams] = useSearchParams();
  const { user } = useDemoAuth();
  const shipments = useDemoList();
  const isWarehouse = user?.franchise?.isWarehouse === 1;
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [destFilter, setDestFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const filtered = useMemo(() => {
    return shipments.filter((s) => {
      const q = searchQuery.toLowerCase();
      const ms = !searchQuery || s.trackingNumber.toLowerCase().includes(q) || s.senderName.toLowerCase().includes(q) || (s as any).originName?.toLowerCase().includes(q) || (s as any).destinationName?.toLowerCase().includes(q);
      const mf = statusFilter === "ALL" || s.status === statusFilter;
      const md = destFilter === "ALL" || s.destinationFranchiseId.toString() === destFilter;
      return ms && mf && md;
    });
  }, [shipments, searchQuery, statusFilter, destFilter]);

  const readyByDest = useMemo(() => {
    if (!isWarehouse) return [];
    const counts: Record<number, { name: string; count: number }> = {};
    shipments.filter((s) => s.status === "RECIBIDO_EN_BODEGA").forEach((s) => {
      if (!counts[s.destinationFranchiseId]) counts[s.destinationFranchiseId] = { name: (s as any).destinationName || "Desconocido", count: 0 };
      counts[s.destinationFranchiseId].count++;
    });
    return Object.entries(counts).map(([id, data]) => ({ id: Number(id), ...data }));
  }, [shipments, isWarehouse]);

  const toggleSelection = (id: number) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const selectAll = () => { const all = filtered.every((s) => selectedIds.includes(s.id)); setSelectedIds(all ? [] : filtered.map((s) => s.id)); };
  const generateBitacora = () => { if (selectedIds.length === 0) return; window.open(`/bitacora?ids=${selectedIds.join(",")}`, "_blank"); };
  const clearFilters = () => { setStatusFilter("ALL"); setDestFilter("ALL"); setSearchQuery(""); };

  const hasFilters = statusFilter !== "ALL" || destFilter !== "ALL" || searchQuery !== "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Mis Envios</h1>
          <p className="text-[#8A8A8A] mt-1">{filtered.length} envio{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}{selectedIds.length > 0 && <span className="ml-2 text-[#C8102E] font-medium">({selectedIds.length} seleccionado{selectedIds.length !== 1 ? "s" : ""})</span>}</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && <Button onClick={generateBitacora} variant="outline" className="border-[#C8102E]/20 text-[#C8102E] hover:bg-[#FFF5F5]"><ClipboardList className="w-4 h-4 mr-2" />Generar Bitacora</Button>}
          <Link to="/enviar" className="inline-flex items-center justify-center px-4 py-2.5 bg-[#C8102E] text-white rounded-lg text-sm font-medium hover:bg-[#9B0B22]"><Package className="w-4 h-4 mr-2" />Nuevo Envio</Link>
        </div>
      </div>

      {isWarehouse && readyByDest.length > 0 && (
        <Card className="border-[#C8102E]/20 bg-[#FFF5F5]/50">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-[#C8102E] flex items-center gap-2 mb-3"><ClipboardList className="w-4 h-4" />Listos para Enviar por Destino ({readyByDest.reduce((a, c) => a + c.count, 0)})</p>
            <div className="flex flex-wrap gap-2">
              {readyByDest.map((c) => (
                <button key={c.id} onClick={() => { setStatusFilter("RECIBIDO_EN_BODEGA"); setDestFilter(c.id.toString()); }} className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${statusFilter === "RECIBIDO_EN_BODEGA" && destFilter === c.id.toString() ? "bg-[#C8102E] text-white shadow-sm" : "bg-white border-2 border-[#C8102E]/20 text-[#C8102E] hover:bg-[#FFF5F5]"}`}>
                  <Store className="w-4 h-4" />{c.name}<span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-bold ${statusFilter === "RECIBIDO_EN_BODEGA" && destFilter === c.id.toString() ? "bg-[#9B0B22] text-white" : "bg-[#FFF5F5] text-[#C8102E]"}`}>{c.count}</span>
                </button>
              ))}
            </div>
            {statusFilter === "RECIBIDO_EN_BODEGA" && destFilter !== "ALL" && (
              <div className="mt-3 pt-3 border-t border-[#C8102E]/10 flex items-center gap-2">
                <p className="text-xs text-[#8A8A8A]">Mostrando <strong className="text-[#C8102E]">{filtered.length}</strong> envio{filtered.length !== 1 ? "s" : ""} listo{filtered.length !== 1 ? "s" : ""} para enviar</p>
                <button onClick={() => { setStatusFilter("ALL"); setDestFilter("ALL"); }} className="text-xs text-[#A3A3A3] hover:text-[#C8102E] underline ml-auto">Limpiar filtro</button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" /><input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 h-11 rounded-lg border border-[#D4D4D4] text-sm focus:ring-[#C8102E] focus:border-[#C8102E] outline-none" /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-11 rounded-lg border border-[#D4D4D4] text-sm px-3 focus:ring-[#C8102E] focus:border-[#C8102E] outline-none">
          <option value="ALL">Todos los estados</option>
          {Object.entries(statusConfig).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
        </select>
        <div className="flex gap-2">
          <select value={destFilter} onChange={(e) => setDestFilter(e.target.value)} className="h-11 flex-1 rounded-lg border border-[#D4D4D4] text-sm px-3 focus:ring-[#C8102E] focus:border-[#C8102E] outline-none">
            <option value="ALL">Todos los destinos</option>
            {[{ id: 1, displayName: "Los Chiles" }, { id: 2, displayName: "Pavon" }, { id: 3, displayName: "Santa Rosa" }, { id: 4, displayName: "Boca Arenal" }, { id: 5, displayName: "Florencia" }, { id: 6, displayName: "Fortuna" }, { id: 7, displayName: "Ciudad Quesada" }].map((f) => (<option key={f.id} value={f.id.toString()}>{f.displayName}</option>))}
          </select>
          {hasFilters && <button onClick={clearFilters} className="h-11 px-3 rounded-lg border border-[#D4D4D4] text-[#8A8A8A] hover:bg-[#F0F0F0]"><X className="w-4 h-4" /></button>}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center"><Package className="w-12 h-12 text-[#D4D4D4] mx-auto mb-3" /><p className="text-[#8A8A8A]">{hasFilters ? "No se encontraron envios" : "No hay envios"}</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.length > 1 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-[#F7F7F7] rounded-lg border border-[#D4D4D4]">
              <Checkbox checked={filtered.every((s) => selectedIds.includes(s.id))} onCheckedChange={selectAll} className="border-[#D4D4D4] data-[state=checked]:bg-[#C8102E] data-[state=checked]:border-[#C8102E]" />
              <span className="text-sm text-[#525252] font-medium">Seleccionar todos los visibles</span>
            </div>
          )}
          {filtered.map((s) => {
            const cfg = statusConfig[s.status];
            const isSel = selectedIds.includes(s.id);
            return (
              <div key={s.id} className="relative">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10"><Checkbox checked={isSel} onCheckedChange={() => toggleSelection(s.id)} className="border-[#D4D4D4] data-[state=checked]:bg-[#C8102E] data-[state=checked]:border-[#C8102E]" /></div>
                <Link to={`/envios/${s.id}`}>
                  <Card className={`hover:shadow-md transition-shadow cursor-pointer border-[#F0F0F0] ${isSel ? "ring-2 ring-[#C8102E]/20 border-[#C8102E]/30 bg-[#FFF5F5]/50" : ""}`}>
                    <CardContent className="p-4 pl-10">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="font-semibold font-mono text-[#C8102E] text-lg">{s.trackingNumber}</p>
                            {cfg && <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-sm text-[#8A8A8A]"><span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{s.senderName}</span>{s.invoiceNumber && <span className="text-[#A3A3A3]">| Fact: #{s.invoiceNumber}</span>}</div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-[#8A8A8A]"><span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFF5F5] text-[#C8102E] rounded text-xs font-medium"><Store className="w-3 h-3" />{(s as any).originName}</span><span className="text-[#D4D4D4]">-</span><span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-[#1B6B3E] rounded text-xs font-medium">{(s as any).destinationName}</span></div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <p className="text-xs text-[#A3A3A3]">{s.createdAt ? format(new Date(s.createdAt), "dd/MM/yyyy HH:mm", { locale: es }) : "-"}</p>
                          <p className="text-xs text-[#8A8A8A]">{(s as any).currentLocationName}</p>
                          <button onClick={(e) => { e.preventDefault(); window.open(`/boleta/${s.id}`, "_blank"); }} className="inline-flex items-center gap-1 text-xs text-[#C8102E] hover:text-[#9B0B22] hover:underline font-medium"><Printer className="w-3 h-3" />Boleta</button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
