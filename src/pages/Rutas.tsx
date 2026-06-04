import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Truck, Plus, MapPin, Package, ChevronRight, AlertCircle, Play, CheckCircle, XCircle, ClipboardList } from "lucide-react";
import toast from "react-hot-toast";

function getStatusConfig(status: string) {
  const configs: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    PLANIFICADA: { color: "bg-blue-50 text-blue-700", label: "Planificada", icon: AlertCircle },
    EN_RUTA: { color: "bg-amber-50 text-[#B8860B]", label: "En Ruta", icon: Play },
    COMPLETADA: { color: "bg-emerald-50 text-[#1B6B3E]", label: "Completada", icon: CheckCircle },
    CANCELADA: { color: "bg-red-50 text-red-700", label: "Cancelada", icon: XCircle },
  };
  return configs[status] || { color: "bg-gray-100 text-gray-500", label: status, icon: AlertCircle };
}

export default function Rutas() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useFranchiseAuth();

  // Solo Bodega y Chofer pueden acceder a Rutas
  useEffect(() => {
    if (!authLoading && user) {
      const isWarehouse = user?.franchise?.isWarehouse === 1;
      const isDriver = user?.username === "chofer";
      if (!isWarehouse && !isDriver) {
        navigate("/dashboard");
      }
    }
  }, [user, authLoading, navigate]);

  const [createDialog, setCreateDialog] = useState(false);
  const [pendingDialog, setPendingDialog] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [cities, setCities] = useState<string[]>([""]);
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<number[]>([]);
  const utils = trpc.useUtils();

  const { data: routes, isLoading } = trpc.route.list.useQuery();
  const { data: pendingByCity } = trpc.route.pendingByPickupPoint.useQuery(undefined, {
    enabled: pendingDialog,
  });

  const createMutation = trpc.route.create.useMutation({
    onSuccess: () => {
      utils.route.list.invalidate();
      setCreateDialog(false);
      setRouteName("");
      setCities([""]);
      toast.success("Ruta creada exitosamente");
    },
    onError: (err) => toast.error(err.message),
  });

  const addCity = () => setCities([...cities, ""]);
  const updateCity = (idx: number, val: string) => {
    const next = [...cities];
    next[idx] = val;
    setCities(next);
  };
  const removeCity = (idx: number) => {
    if (cities.length <= 1) return;
    setCities(cities.filter((_, i) => i !== idx));
  };

  const handleCreate = () => {
    const validCities = cities.map(c => c.trim()).filter(Boolean);
    if (!routeName.trim() || validCities.length === 0) {
      toast.error("Ingrese nombre y al menos una ciudad");
      return;
    }
    createMutation.mutate({ name: routeName.trim(), stops: validCities.map(c => ({ cityName: c })) });
  };

  const toggleShipment = (shipmentId: number) => {
    setSelectedShipmentIds(prev =>
      prev.includes(shipmentId) ? prev.filter(id => id !== shipmentId) : [...prev, shipmentId]
    );
  };

  const addCityFromPending = (cityName: string) => {
    const cleanCity = cityName.replace("Recogida - ", "").trim();
    if (!cities.some(c => c.trim().toLowerCase() === cleanCity.toLowerCase())) {
      setCities([...cities.filter(c => c.trim()), cleanCity]);
    }
  };

  const totalPending = pendingByCity?.reduce((sum, group) => sum + group.count, 0) || 0;

  return (
    <FranchiseLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Rutas de Camion</h1>
            <p className="text-sm text-[#404040] mt-1">Gestion de rutas de entrega semanales</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setPendingDialog(true)} variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50">
              <ClipboardList className="w-4 h-4 mr-2" />
              Envios Pendientes
              {totalPending > 0 && (
                <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-700">
                  {totalPending}
                </Badge>
              )}
            </Button>
            <Button onClick={() => setCreateDialog(true)} className="bg-[#C8102E] hover:bg-[#9B0B22]">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Ruta
            </Button>
          </div>
        </div>

        {/* Pending Shipments Alert */}
        {totalPending > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-800">
                    Hay {totalPending} envio{totalPending !== 1 ? "s" : ""} en bodega esperando ruta
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {pendingByCity?.map((group) => (
                      <Badge key={group.pickupId} variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                        <MapPin className="w-3 h-3 mr-1" />
                        {group.cityName}: {group.count}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600 mt-2">
                    Cree una ruta y asigne los envios a cada parada
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8102E]" />
          </div>
        ) : !routes || routes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Truck className="w-12 h-12 text-[#D4D4D4] mx-auto mb-3" />
              <p className="text-[#404040]">No hay rutas creadas</p>
              <Button onClick={() => setCreateDialog(true)} variant="outline" className="mt-4">
                Crear primera ruta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {routes.map((route) => {
              const cfg = getStatusConfig(route.status);
              return (
                <Link to={`/rutas/${route.id}`} key={route.id}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer border-[#F0F0F0] hover:border-[#C8102E]/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-[#FFF5F5] rounded-lg flex items-center justify-center">
                            <Truck className="w-5 h-5 text-[#C8102E]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-[#1A1A1A]">{route.name}</p>
                              {cfg && (
                                <Badge variant="secondary" className={cfg.color}>
                                  <cfg.icon className="w-3 h-3 mr-1" />
                                  {cfg.label}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-[#404040] mt-0.5">
                              Creada: {new Date(route.createdAt).toLocaleDateString("es-CR")}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#525252]" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Route Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#C8102E]" />
              Nueva Ruta de Camion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#1A1A1A] block mb-1">Nombre de la ruta</label>
              <Input
                placeholder="Ej: Ruta Semana 15-21 Junio"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1A1A1A] block mb-1">Ciudades de parada (en orden)</label>
              <div className="space-y-2">
                {cities.map((city, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="w-8 h-8 bg-[#F7F7F7] rounded flex items-center justify-center text-xs font-mono text-[#525252] font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <Input
                      placeholder="Ej: San Ramon"
                      value={city}
                      onChange={(e) => updateCity(idx, e.target.value)}
                      className="flex-1"
                    />
                    {cities.length > 1 && (
                      <Button variant="outline" size="sm" onClick={() => removeCity(idx)} className="text-red-600">
                        X
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addCity} className="mt-2 text-[#C8102E]">
                <MapPin className="w-3 h-3 mr-1" />
                Agregar parada
              </Button>
            </div>
            <Button
              onClick={handleCreate}
              className="w-full bg-[#C8102E] hover:bg-[#9B0B22]"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creando..." : "Crear Ruta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Shipments Dialog */}
      <Dialog open={pendingDialog} onOpenChange={setPendingDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-orange-600" />
              Envios Pendientes por Punto de Recogida
            </DialogTitle>
          </DialogHeader>

          {!pendingByCity || pendingByCity.length === 0 ? (
            <div className="text-center py-8 text-[#404040]">
              <Package className="w-10 h-10 text-[#D4D4D4] mx-auto mb-2" />
              <p>No hay envios pendientes para puntos de recogida</p>
              <p className="text-xs mt-1 text-[#8A8A8A]">Los envios deben estar en bodega con destino a Grecia, San Ramon o Palmares</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pendingByCity.map((group) => (
                <div key={group.pickupId} className="border border-orange-200 rounded-lg p-4 bg-orange-50/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-orange-600" />
                      <h3 className="font-bold text-orange-800">{group.cityName}</h3>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                        {group.count} envio{group.count !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addCityFromPending(group.fullDisplayName)}
                      className="text-[#C8102E] border-[#C8102E]"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Agregar a Ruta
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {group.shipments.map((s: any) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 p-2 rounded bg-white border border-[#F0F0F0]"
                      >
                        <Checkbox
                          checked={selectedShipmentIds.includes(s.id)}
                          onCheckedChange={() => toggleShipment(s.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-[#C8102E]">{s.trackingNumber}</span>
                            {s.invoiceNumber && <span className="text-xs text-[#525252]">Fact: #{s.invoiceNumber}</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#525252]">
                            <span>{s.senderName}</span>
                            <span className="text-[#8A8A8A]">|</span>
                            <span>{s.senderPhone}</span>
                          </div>
                          <p className="text-xs text-[#8A8A8A] truncate">
                            {s.items?.map((i: any) => `${i.description} x${i.quantity}`).join(", ")}
                          </p>
                        </div>
                        <span className="text-xs text-[#8A8A8A] shrink-0">{s.originFranchise?.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {selectedShipmentIds.length > 0 && (
                <div className="sticky bottom-0 bg-white p-3 border-t border-[#F0F0F0]">
                  <Button
                    onClick={() => {
                      setPendingDialog(false);
                      setCreateDialog(true);
                    }}
                    className="w-full bg-[#C8102E] hover:bg-[#9B0B22]"
                  >
                    Crear Ruta con {selectedShipmentIds.length} envio{selectedShipmentIds.length !== 1 ? "s" : ""} seleccionado{selectedShipmentIds.length !== 1 ? "s" : ""}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FranchiseLayout>
  );
}
