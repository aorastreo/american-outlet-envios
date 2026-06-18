import { useState, useMemo } from "react";
import { Link } from "react-router";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Search, Truck, MapPin, CheckCircle, Clock, ClipboardList, Filter, X, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function getStatusConfig(status: string) {
  const configs: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    CREADO: { color: "bg-slate-100 text-[#1A1A1A]", label: "Creado", icon: Package },
    SOLICITADO_RECOLECCION: { color: "bg-amber-50 text-[#B8860B]", label: "Solicitado Recoleccion", icon: Clock },
    RECOLECTADO: { color: "bg-blue-50 text-blue-700", label: "Recolectado", icon: Truck },
    ENTREGADO: { color: "bg-emerald-50 text-[#1B6B3E]", label: "Entregado", icon: CheckCircle },
  };
  return configs[status] || { color: "bg-gray-100 text-gray-500", label: status, icon: Package };
}

export default function NationalShipments() {
  const { user } = useFranchiseAuth();
  const isWarehouse = user?.franchise?.isWarehouse === 1;
  const { data: shipments, isLoading } = trpc.nationalShipping.list.useQuery();
  const utils = trpc.useUtils();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const requestPickupMutation = trpc.nationalShipping.requestPickup.useMutation({
    onSuccess: () => {
      utils.nationalShipping.list.invalidate();
      setSelectedIds([]);
    },
  });

  const filteredShipments = useMemo(() => {
    return (shipments || []).filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        s.trackingNumber.toLowerCase().includes(q) ||
        (s.receiverName || "").toLowerCase().includes(q) ||
        (s.province || "").toLowerCase().includes(q) ||
        (s.canton || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [shipments, searchQuery, statusFilter]);

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleRequestPickup = () => {
    if (selectedIds.length === 0) return;
    requestPickupMutation.mutate({ shipmentIds: selectedIds });
  };

  const creadoCount = shipments?.filter(s => s.status === "CREADO").length || 0;
  const solicitudCount = shipments?.filter(s => s.status === "SOLICITADO_RECOLECCION").length || 0;
  const recolectadoCount = shipments?.filter(s => s.status === "RECOLECTADO").length || 0;
  const entregadoCount = shipments?.filter(s => s.status === "ENTREGADO").length || 0;

  return (
    <FranchiseLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A] flex items-center gap-2">
              <Truck className="w-7 h-7 text-[#C8102E]" />
              Envios Nacionales
            </h1>
            <p className="text-[#8A8A8A] mt-1">Envios a todo el pais</p>
          </div>
          <Link to="/envio-nacional">
            <Button className="bg-[#C8102E] hover:bg-[#9B0B22]">
              <Package className="w-4 h-4 mr-2" />
              Nuevo Envio
            </Button>
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-[#1A1A1A]">{creadoCount}</p>
              <p className="text-xs text-[#8A8A8A]">Creados</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-[#B8860B]">{solicitudCount}</p>
              <p className="text-xs text-[#B8860B]">Recoleccion Solicitada</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{recolectadoCount}</p>
              <p className="text-xs text-blue-600">En Transito</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-[#1B6B3E]">{entregadoCount}</p>
              <p className="text-xs text-[#1B6B3E]">Entregados</p>
            </CardContent>
          </Card>
        </div>
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" />
                <Input
                  placeholder="Buscar por guia, destinatario o ubicacion..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="CREADO">Creado</SelectItem>
                  <SelectItem value="SOLICITADO_RECOLECCION">Solicitado Recoleccion</SelectItem>
                  <SelectItem value="RECOLECTADO">En Transito</SelectItem>
                  <SelectItem value="ENTREGADO">Entregado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 flex items-center justify-between">
              <span className="text-amber-800 font-medium">
                {selectedIds.length} envio{selectedIds.length !== 1 ? "s" : ""} seleccionado{selectedIds.length !== 1 ? "s" : ""}
              </span>
              <Button
                onClick={handleRequestPickup}
                className="bg-amber-600 hover:bg-amber-700"
                disabled={requestPickupMutation.isPending}
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                {requestPickupMutation.isPending ? "Solicitando..." : "Solicitar Recoleccion"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8102E]" />
          </div>
        ) : filteredShipments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-[#8A8A8A]">
              <Package className="w-12 h-12 mx-auto mb-3 text-[#D4D4D4]" />
              <p className="font-medium">No hay envios nacionales</p>
              <p className="text-sm mt-1">Cree su primer envio nacional</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredShipments.map((s) => {
              const cfg = getStatusConfig(s.status);
              const isSelected = selectedIds.includes(s.id);
              const canSelect = s.status === "CREADO";

              return (
                <Card key={s.id} className={`hover:shadow-md transition-shadow ${isSelected ? "ring-2 ring-[#C8102E]/20 border-[#C8102E]/30" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {canSelect && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(s.id)}
                          className="border-[#D4D4D4] data-[state=checked]:bg-[#C8102E] data-[state=checked]:border-[#C8102E]"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="inline-block bg-[#1A1A1A] text-white text-xs font-mono font-bold px-2 py-0.5 rounded">
                            {s.trackingNumber}
                          </span>
                          <Badge variant="secondary" className={cfg.color}>
                            <cfg.icon className="w-3 h-3 mr-1" />
                            {cfg.label}
                          </Badge>
                          <span className="text-xs text-[#8A8A8A] bg-[#F7F7F7] px-2 py-0.5 rounded">
                            {s.packageSize === "PEQUENO" ? "Pequeno" : s.packageSize === "MEDIANO" ? "Mediano" : "Grande"} - ¢{s.shippingCost?.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-[#525252] flex-wrap">
                          <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-[#C8102E]" />{s.receiverName}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#C8102E]" />{s.province}, {s.canton}</span>
                          <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5 text-[#C8102E]" />{s.description}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-[#A3A3A3]">
                          {s.createdAt ? format(new Date(s.createdAt), "dd/MM/yyyy HH:mm", { locale: es }) : "-"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </FranchiseLayout>
  );
}