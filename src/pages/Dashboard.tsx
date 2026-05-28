import { useMemo } from "react";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  ClipboardCheck,
  XCircle,
  ArrowRight,
  Barcode,
  User,
  Store,
  AlertTriangle,
  Star,
} from "lucide-react";
import { Link } from "react-router";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const statusConfig: Record<string, { color: string; label: string }> = {
  CREADO: { color: "bg-slate-100 text-[#1A1A1A]", label: "Creado" },
  ENVIADO_A_BODEGA: { color: "bg-amber-50 text-[#B8860B]", label: "Enviado a Bodega" },
  RECIBIDO_EN_BODEGA: { color: "bg-purple-50 text-purple-700", label: "En Bodega" },
  ENVIADO_A_DESTINO: { color: "bg-[#FFF5F5] text-[#C8102E]", label: "Enviado a Destino" },
  RECIBIDO_EN_DESTINO: { color: "bg-emerald-50 text-[#1B6B3E]", label: "Entregado" },
  CANCELADO: { color: "bg-red-50 text-red-700", label: "Cancelado" },
};

export default function Dashboard() {
  const { user } = useFranchiseAuth();
  const { data: stats } = trpc.shipment.stats.useQuery();
  const { data: shipments, isLoading: shipmentsLoading } = trpc.shipment.list.useQuery();

  const isWarehouse = user?.franchise?.isWarehouse === 1;

  const pendingByStore = useMemo(() => {
    if (!isWarehouse || !shipments) return [];
    const groups: Record<number, { id: number; name: string; count: number; shipments: typeof shipments }> = {};
    for (const s of shipments) {
      if (s.status === "ENVIADO_A_BODEGA") {
        if (!groups[s.originFranchiseId]) {
          groups[s.originFranchiseId] = { id: s.originFranchiseId, name: s.originName || "Desconocida", count: 0, shipments: [] };
        }
        groups[s.originFranchiseId].count++;
        groups[s.originFranchiseId].shipments.push(s);
      }
    }
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [shipments, isWarehouse]);

  const inWarehouseByStore = useMemo(() => {
    if (!isWarehouse || !shipments) return [];
    const groups: Record<number, { id: number; name: string; count: number }> = {};
    for (const s of shipments) {
      if (s.status === "RECIBIDO_EN_BODEGA") {
        if (!groups[s.originFranchiseId]) {
          groups[s.originFranchiseId] = { id: s.originFranchiseId, name: s.originName || "Desconocida", count: 0 };
        }
        groups[s.originFranchiseId].count++;
      }
    }
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [shipments, isWarehouse]);

  const recentShipments = shipments?.slice(0, 10) || [];

  const statCards = [
    { label: "Total Envios", value: stats?.total || 0, icon: Package, color: "text-[#C8102E]", bg: "bg-[#FFF5F5]", border: "border-[#C8102E]/10" },
    { label: "Pendientes", value: stats?.pending || 0, icon: Clock, color: "text-[#B8860B]", bg: "bg-amber-50", border: "border-amber-200/50" },
    { label: "En Transito", value: stats?.inTransit || 0, icon: Truck, color: "text-[#D4730E]", bg: "bg-orange-50", border: "border-orange-200/50" },
    { label: "En Bodega", value: stats?.inWarehouse || 0, icon: ClipboardCheck, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200/50" },
    { label: "Entregados", value: stats?.delivered || 0, icon: CheckCircle, color: "text-[#1B6B3E]", bg: "bg-emerald-50", border: "border-emerald-200/50" },
    { label: "Cancelados", value: stats?.cancelled || 0, icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200/50" },
  ];

  return (
    <FranchiseLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Dashboard</h1>
          <p className="text-[#8A8A8A] mt-1">
            Resumen de envios de {isWarehouse ? "la Bodega" : "su franquicia"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className={`${stat.border} border`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#1A1A1A]">{stat.value}</p>
                    <p className="text-xs text-[#8A8A8A]">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* WAREHOUSE: Pending Receptions */}
        {isWarehouse && pendingByStore.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#B8860B]" />
              <h2 className="text-lg font-semibold text-[#1A1A1A]">
                Pendientes de Recepcion en Bodega
              </h2>
              <Badge
                variant="secondary"
                className="bg-amber-100 text-[#B8860B]"
              >
                {pendingByStore.reduce((a, c) => a + c.count, 0)} envios
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingByStore.map((store) => (
                <Link
                  to={`/envios?origin=${store.id}&status=ENVIADO_A_BODEGA`}
                  key={store.id}
                >
                  <Card className="hover:shadow-lg transition-all cursor-pointer border-amber-200 hover:border-[#C8102E]/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Store className="w-5 h-5 text-[#B8860B]" />
                          </div>
                          <div>
                            <p className="font-semibold text-[#1A1A1A]">{store.name}</p>
                            <p className="text-xs text-[#8A8A8A]">
                              {store.count} envio{store.count !== 1 ? "s" : ""} por recibir
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-[#C8102E]" />
                      </div>
                      <div className="mt-3 pt-3 border-t border-[#F0F0F0] space-y-1">
                        {store.shipments.slice(0, 3).map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="font-mono text-[#C8102E]">
                              {s.trackingNumber}
                            </span>
                            <span className="text-[#A3A3A3]">
                              → {s.destinationName}
                            </span>
                          </div>
                        ))}
                        {store.shipments.length > 3 && (
                          <p className="text-xs text-[#A3A3A3] mt-1">
                            +{store.shipments.length - 3} mas...
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* WAREHOUSE: In Warehouse */}
        {isWarehouse && inWarehouseByStore.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-[#1A1A1A]">
                En Bodega Listos para Enviar
              </h2>
              <Badge
                variant="secondary"
                className="bg-purple-100 text-purple-700"
              >
                {inWarehouseByStore.reduce((a, c) => a + c.count, 0)} envios
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {inWarehouseByStore.map((store) => (
                <Link
                  key={store.id}
                  to={`/envios?origin=${store.id}&status=RECIBIDO_EN_BODEGA`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-[#C8102E]/30 transition-colors"
                >
                  <Store className="w-4 h-4 text-purple-600" />
                  <span className="font-medium text-[#1A1A1A]">{store.name}</span>
                  <Badge
                    variant="secondary"
                    className="bg-purple-100 text-purple-700"
                  >
                    {store.count}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/enviar">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-[#C8102E]/20 bg-[#FFF5F5]/50 hover:border-[#C8102E]/40">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-[#C8102E] rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[#1A1A1A]">
                    Crear Nuevo Envio
                  </h3>
                  <p className="text-sm text-[#8A8A8A]">
                    Agregar articulos y enviar a otra franquicia
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-[#C8102E]" />
              </CardContent>
            </Card>
          </Link>
          <Link to="/rastrear">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-[#D4D4D4] hover:border-[#C8102E]/30">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-[#1A1A1A] rounded-xl flex items-center justify-center">
                  <Star className="w-6 h-6 text-white fill-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[#1A1A1A]">
                    Rastrear Envio
                  </h3>
                  <p className="text-sm text-[#8A8A8A]">
                    Buscar envio por numero de rastreo
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-[#C8102E]" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Shipments */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#1A1A1A]">
              Envios Recientes
            </h2>
            <Link
              to="/envios"
              className="text-sm text-[#C8102E] hover:text-[#9B0B22] font-medium"
            >
              Ver todos
            </Link>
          </div>

          {shipmentsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8102E]"></div>
            </div>
          ) : recentShipments.length === 0 ? (
            <Card className="border-[#D4D4D4]">
              <CardContent className="p-12 text-center">
                <Package className="w-12 h-12 text-[#D4D4D4] mx-auto mb-3" />
                <p className="text-[#8A8A8A]">No hay envios registrados</p>
                <Link
                  to="/enviar"
                  className="text-[#C8102E] text-sm mt-2 inline-block hover:underline"
                >
                  Crear primer envio
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentShipments.map((shipment) => {
                const cfg = statusConfig[shipment.status];
                return (
                  <Link to={`/envios/${shipment.id}`} key={shipment.id}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer border-[#F0F0F0] hover:border-[#C8102E]/20">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Barcode className="w-4 h-4 text-[#C8102E]" />
                                <p className="font-semibold font-mono text-[#C8102E] text-lg">
                                  {shipment.trackingNumber}
                                </p>
                              </div>
                              {cfg && (
                                <span
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}
                                >
                                  {cfg.label}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm text-[#8A8A8A]">
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5" />
                                {shipment.senderName}
                              </span>
                              {shipment.invoiceNumber && (
                                <span className="text-[#A3A3A3]">
                                  | Fact: #{shipment.invoiceNumber}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm text-[#8A8A8A]">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFF5F5] text-[#C8102E] rounded text-xs font-medium">
                                <Store className="w-3 h-3" />
                                {shipment.originName}
                              </span>
                              <span className="text-[#D4D4D4]">→</span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-[#1B6B3E] rounded text-xs font-medium">
                                {shipment.destinationName}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-[#A3A3A3]">
                              {shipment.createdAt
                                ? format(
                                    new Date(shipment.createdAt),
                                    "dd/MM/yyyy HH:mm",
                                    { locale: es }
                                  )
                                : "-"}
                            </p>
                            <p className="text-xs text-[#8A8A8A] mt-1">
                              {shipment.currentLocationName}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </FranchiseLayout>
  );
}
