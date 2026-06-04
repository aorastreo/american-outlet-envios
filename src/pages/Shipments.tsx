import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Package, Search, ArrowRight, User, Send, ClipboardCheck, Truck, CheckCircle, Store, Filter, X, Printer, ClipboardList, MapPin } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function getStatusConfig(status: string) {
  const configs: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    CREADO: { color: "bg-slate-100 text-[#1A1A1A] hover:bg-slate-200", label: "Creado", icon: Package },
    ENVIADO_A_BODEGA: { color: "bg-amber-50 text-[#B8860B] hover:bg-amber-100", label: "Enviado a Bodega", icon: Send },
    RECIBIDO_EN_BODEGA: { color: "bg-purple-50 text-purple-700 hover:bg-purple-100", label: "En Bodega", icon: ClipboardCheck },
    EN_RUTA: { color: "bg-blue-50 text-blue-700 hover:bg-blue-100", label: "En Ruta de Camion", icon: Truck },
    EN_PARADA: { color: "bg-orange-50 text-orange-700 hover:bg-orange-100", label: "En Punto de Recogida", icon: MapPin },
    ENVIADO_A_DESTINO: { color: "bg-[#FFF5F5] text-[#C8102E] hover:bg-[#FFE0E0]", label: "Enviado a Destino", icon: Truck },
    RECIBIDO_EN_DESTINO: { color: "bg-emerald-50 text-[#1B6B3E] hover:bg-emerald-100", label: "Entregado", icon: CheckCircle },
    CANCELADO: { color: "bg-red-50 text-red-700 hover:bg-red-100", label: "Cancelado", icon: Package },
  };
  return configs[status] || { color: "bg-gray-100 text-gray-500 hover:bg-gray-200", label: status, icon: Package };
}

export default function Shipments() {
  const [searchParams] = useSearchParams();
  const { user } = useFranchiseAuth();
  const { data: shipments, isLoading } = trpc.shipment.list.useQuery();
  const { data: allFranchises } = trpc.franchise.list.useQuery();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const urlOriginId = searchParams.get("origin");
  const urlStatus = searchParams.get("status");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(urlStatus || "ALL");
  const [originFilter, setOriginFilter] = useState<string>(urlOriginId || "ALL");
  const [destFilter, setDestFilter] = useState<string>("ALL");

  // Sync with URL params
  useEffect(() => {
    if (urlOriginId) setOriginFilter(urlOriginId);
    if (urlStatus) setStatusFilter(urlStatus);
  }, [urlOriginId, urlStatus]);

  const isWarehouse = user?.franchise?.isWarehouse === 1;
  const storeFranchises = (allFranchises || []).filter((f) => !f.isWarehouse);

  const filteredShipments = useMemo(() => {
    return (shipments || []).filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        s.trackingNumber.toLowerCase().includes(q) ||
        (s.senderName || "").toLowerCase().includes(q) ||
        (s.originName || "").toLowerCase().includes(q) ||
        (s.destinationName || "").toLowerCase().includes(q) ||
        (s.invoiceNumber || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
      const matchesOrigin = originFilter === "ALL" || s.originFranchiseId.toString() === originFilter;
      const matchesDest = destFilter === "ALL" || s.destinationFranchiseId.toString() === destFilter;
      return matchesSearch && matchesStatus && matchesOrigin && matchesDest;
    });
  }, [shipments, searchQuery, statusFilter, originFilter, destFilter]);

  // Count by origin store (for warehouse)
  const countsByOrigin = useMemo(() => {
    if (!isWarehouse || !shipments) return [];
    const counts: Record<number, { id: number; name: string; count: number }> = {};
    for (const s of shipments) {
      if (!counts[s.originFranchiseId]) {
        counts[s.originFranchiseId] = { id: s.originFranchiseId, name: s.originName || "Desconocida", count: 0 };
      }
      counts[s.originFranchiseId].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [shipments, isWarehouse]);

  // Pending by origin store (ENVIADO_A_BODEGA status)
  const pendingByStore = useMemo(() => {
    if (!isWarehouse || !shipments) return [];
    const counts: Record<number, { id: number; name: string; count: number }> = {};
    for (const s of shipments) {
      if (s.status === "ENVIADO_A_BODEGA") {
        if (!counts[s.originFranchiseId]) {
          counts[s.originFranchiseId] = { id: s.originFranchiseId, name: s.originName || "Desconocida", count: 0 };
        }
        counts[s.originFranchiseId].count++;
      }
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [shipments, isWarehouse]);

  // READY TO SEND by destination (RECIBIDO_EN_BODEGA status) — for warehouse
  const readyByDestination = useMemo(() => {
    if (!isWarehouse || !shipments) return [];
    const counts: Record<number, { id: number; name: string; count: number }> = {};
    for (const s of shipments) {
      if (s.status === "RECIBIDO_EN_BODEGA") {
        if (!counts[s.destinationFranchiseId]) {
          counts[s.destinationFranchiseId] = { id: s.destinationFranchiseId, name: s.destinationName || "Desconocido", count: 0 };
        }
        counts[s.destinationFranchiseId].count++;
      }
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [shipments, isWarehouse]);

  const renderShipmentCard = (shipment: (typeof filteredShipments)[0]) => {
    const cfg = getStatusConfig(shipment.status);
    const isSelected = selectedIds.includes(shipment.id);
    return (
      <div key={shipment.id} className="relative group">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelection(shipment.id)}
            className="border-[#D4D4D4] data-[state=checked]:bg-[#C8102E] data-[state=checked]:border-[#C8102E]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <Link to={`/envios/${shipment.id}`} className="block">
          <Card className={`hover:shadow-md transition-shadow cursor-pointer border-[#F0F0F0] ${isSelected ? "ring-2 ring-[#C8102E]/20 border-[#C8102E]/30 bg-[#FFF5F5]/50" : ""}`}>
            <CardContent className="p-4 pl-10">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-semibold font-mono text-[#C8102E] text-lg">{shipment.trackingNumber}</p>
                    {cfg && <Badge variant="secondary" className={cfg.color}><cfg.icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-sm text-[#8A8A8A]">
                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{shipment.senderName}</span>
                    {shipment.invoiceNumber && <span className="text-[#A3A3A3]">| Fac: #{shipment.invoiceNumber}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-[#8A8A8A]">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFF5F5] text-[#C8102E] rounded text-xs font-medium">
                      <Store className="w-3 h-3" />{shipment.originName}
                    </span>
                    <ArrowRight className="w-4 h-4 text-[#D4D4D4]" />
                    {shipment.destinationName?.toLowerCase().includes("recogida") ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs font-bold border border-orange-200">
                        <MapPin className="w-3 h-3" />{shipment.destinationName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-[#1B6B3E] rounded text-xs font-medium">
                        {shipment.destinationName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-xs text-[#A3A3A3]">{shipment.createdAt ? format(new Date(shipment.createdAt), "dd/MM/yyyy HH:mm", { locale: es }) : "-"}</p>
                  <p className="text-xs text-[#8A8A8A]">{shipment.currentLocationName}</p>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(`/boleta/${shipment.id}`, "_blank"); }}
                    className="inline-flex items-center gap-1 text-xs text-[#C8102E] hover:text-[#9B0B22] hover:underline mt-1 font-medium"
                  >
                    <Printer className="w-3 h-3" />Boleta
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    );
  };

  const hasFilters = statusFilter !== "ALL" || originFilter !== "ALL" || destFilter !== "ALL" || searchQuery !== "";

  const clearFilters = () => {
    setStatusFilter("ALL");
    setOriginFilter("ALL");
    setDestFilter("ALL");
    setSearchQuery("");
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const selectAllVisible = () => {
    const allSelected = filteredShipments.every((s) => selectedIds.includes(s.id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredShipments.find((s) => s.id === id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...filteredShipments.map((s) => s.id)])]);
    }
  };

  const generateBitacora = () => {
    if (selectedIds.length === 0) return;
    const idsParam = selectedIds.join(",");
    window.open(`/bitacora?ids=${idsParam}`, "_blank");
  };

  return (
    <FranchiseLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Mis Envios</h1>
            <p className="text-[#8A8A8A] mt-1">{filteredShipments.length} envio{filteredShipments.length !== 1 ? "s" : ""} encontrado{filteredShipments.length !== 1 ? "s" : ""}{selectedIds.length > 0 && <span className="ml-2 text-[#C8102E] font-medium">({selectedIds.length} seleccionado{selectedIds.length !== 1 ? "s" : ""})</span>}</p>
          </div>
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <Button onClick={generateBitacora} variant="outline" className="border-[#C8102E]/20 text-[#C8102E] hover:bg-[#FFF5F5]">
                <ClipboardList className="w-4 h-4 mr-2" />Generar Bitacora
              </Button>
            )}
            <Link to="/enviar" className="inline-flex items-center justify-center px-4 py-2.5 bg-[#C8102E] text-white rounded-lg text-sm font-medium hover:bg-[#9B0B22] transition-colors">
              <Package className="w-4 h-4 mr-2" />Nuevo Envio
            </Link>
          </div>
        </div>

        {/* WAREHOUSE: Pending by Store */}
        {isWarehouse && pendingByStore.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[#B8860B] flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Pendientes de Recepcion ({pendingByStore.reduce((a, c) => a + c.count, 0)})
                </p>
                <span className="text-xs text-amber-600">Envios esperando confirmacion de bodega</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {pendingByStore.map((c) => (
                  <Link
                    key={c.id}
                    to={`/envios?origin=${c.id}&status=ENVIADO_A_BODEGA`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      originFilter === c.id.toString() && statusFilter === "ENVIADO_A_BODEGA"
                        ? "bg-[#B8860B] text-white"
                        : "bg-white border border-amber-200 text-[#B8860B] hover:bg-amber-100"
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    {c.name}
                    <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${originFilter === c.id.toString() && statusFilter === "ENVIADO_A_BODEGA" ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-600"}`}>
                      {c.count}
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* WAREHOUSE: Ready to Send by Destination */}
        {isWarehouse && readyByDestination.length > 0 && (
          <Card className="border-[#C8102E]/20 bg-[#FFF5F5]/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[#C8102E] flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Listos para Enviar por Destino ({readyByDestination.reduce((a, c) => a + c.count, 0)})
                </p>
                <span className="text-xs text-[#8A8A8A]">Seleccione una tienda para filtrar y generar bitacora</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {readyByDestination.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setStatusFilter("RECIBIDO_EN_BODEGA");
                      setDestFilter(c.id.toString());
                      setOriginFilter("ALL");
                      setSelectedIds([]);
                    }}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                      statusFilter === "RECIBIDO_EN_BODEGA" && destFilter === c.id.toString()
                        ? "bg-[#C8102E] text-white shadow-sm"
                        : "bg-white border-2 border-[#C8102E]/20 text-[#C8102E] hover:bg-[#FFF5F5] hover:border-[#C8102E]/40"
                    }`}
                  >
                    <Store className="w-4 h-4" />
                    {c.name}
                    <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-bold ${statusFilter === "RECIBIDO_EN_BODEGA" && destFilter === c.id.toString() ? "bg-[#9B0B22] text-white" : "bg-[#FFF5F5] text-[#C8102E]"}`}>
                      {c.count}
                    </span>
                  </button>
                ))}
              </div>
              {statusFilter === "RECIBIDO_EN_BODEGA" && destFilter !== "ALL" && (
                <div className="mt-3 pt-3 border-t border-[#C8102E]/10 flex items-center gap-2">
                  <p className="text-xs text-[#8A8A8A]">
                    Mostrando {filteredShipments.length} envio{filteredShipments.length !== 1 ? "s" : ""} listo{filteredShipments.length !== 1 ? "s" : ""} para enviar a <strong className="text-[#C8102E]">{storeFranchises.find(f => f.id.toString() === destFilter)?.displayName || destFilter}</strong>
                  </p>
                  <button
                    onClick={() => { setStatusFilter("ALL"); setDestFilter("ALL"); setSelectedIds([]); }}
                    className="text-xs text-[#A3A3A3] hover:text-[#C8102E] underline ml-auto"
                  >
                    Limpiar filtro
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* WAREHOUSE: All stores count */}
        {isWarehouse && countsByOrigin.length > 0 && (
          <Card className="bg-[#F7F7F7] border-[#D4D4D4]">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-[#8A8A8A] mb-3 uppercase tracking-wide">Todos los Envios por Tienda</p>
              <div className="flex flex-wrap gap-2">
                {countsByOrigin.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setOriginFilter(originFilter === c.id.toString() ? "ALL" : c.id.toString())}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      originFilter === c.id.toString()
                        ? "bg-[#C8102E] text-white"
                        : "bg-white border border-[#D4D4D4] text-[#1A1A1A] hover:bg-[#F0F0F0]"
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    {c.name}
                    <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${originFilter === c.id.toString() ? "bg-[#9B0B22] text-white" : "bg-[#F0F0F0] text-[#8A8A8A]"}`}>
                      {c.count}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" />
            <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11 border-[#D4D4D4]" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 border-[#D4D4D4]"><Filter className="w-4 h-4 mr-2 text-[#A3A3A3]" /><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              <SelectItem value="CREADO">Creado</SelectItem>
              <SelectItem value="ENVIADO_A_BODEGA">Enviado a Bodega</SelectItem>
              <SelectItem value="RECIBIDO_EN_BODEGA">Recibido en Bodega</SelectItem>
              <SelectItem value="ENVIADO_A_DESTINO">Enviado a Destino</SelectItem>
              <SelectItem value="RECIBIDO_EN_DESTINO">Entregado</SelectItem>
              <SelectItem value="CANCELADO">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          {isWarehouse && (
            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger className="h-11 border-[#D4D4D4]"><Store className="w-4 h-4 mr-2 text-[#A3A3A3]" /><SelectValue placeholder="Tienda origen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las tiendas</SelectItem>
                {storeFranchises.map((f) => (
                  <SelectItem key={f.id} value={f.id.toString()}>{f.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-2">
            <Select value={destFilter} onValueChange={setDestFilter}>
              <SelectTrigger className="h-11 flex-1 border-[#D4D4D4]"><Store className="w-4 h-4 mr-2 text-[#A3A3A3]" /><SelectValue placeholder="Destino" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los destinos</SelectItem>
                {storeFranchises.map((f) => (
                  <SelectItem key={f.id} value={f.id.toString()}>{f.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <button onClick={clearFilters} className="h-11 px-3 rounded-lg border border-[#D4D4D4] text-[#8A8A8A] hover:bg-[#F0F0F0] transition-colors" title="Limpiar filtros">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8102E]"></div></div>
        ) : filteredShipments.length === 0 ? (
          <Card className="border-[#D4D4D4]"><CardContent className="p-12 text-center"><Package className="w-12 h-12 text-[#D4D4D4] mx-auto mb-3" /><p className="text-[#8A8A8A]">{hasFilters ? "No se encontraron envios con esos filtros" : "No hay envios registrados"}</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filteredShipments.length > 1 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-[#F7F7F7] rounded-lg border border-[#D4D4D4]">
                <Checkbox
                  checked={filteredShipments.every((s) => selectedIds.includes(s.id))}
                  onCheckedChange={selectAllVisible}
                  className="border-[#D4D4D4] data-[state=checked]:bg-[#C8102E] data-[state=checked]:border-[#C8102E]"
                />
                <span className="text-sm text-[#525252] font-medium">Seleccionar todos los visibles</span>
                <span className="text-xs text-[#A3A3A3] ml-1">({filteredShipments.length})</span>
              </div>
            )}
            {filteredShipments.map((s) => renderShipmentCard(s))}
          </div>
        )}
      </div>
    </FranchiseLayout>
  );
}
