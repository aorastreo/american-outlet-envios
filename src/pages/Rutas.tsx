import { useState } from "react";
import { Link } from "react-router";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Truck, Plus, MapPin, Package, ChevronRight, AlertCircle, Play, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";

const statusConfig: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  PLANIFICADA: { color: "bg-blue-50 text-blue-700", label: "Planificada", icon: AlertCircle },
  EN_RUTA: { color: "bg-amber-50 text-[#B8860B]", label: "En Ruta", icon: Play },
  COMPLETADA: { color: "bg-emerald-50 text-[#1B6B3E]", label: "Completada", icon: CheckCircle },
  CANCELADA: { color: "bg-red-50 text-red-700", label: "Cancelada", icon: XCircle },
};

export default function Rutas() {
  const [createDialog, setCreateDialog] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [cities, setCities] = useState<string[]>([""]);
  const utils = trpc.useUtils();

  const { data: routes, isLoading } = trpc.route.list.useQuery();

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

  return (
    <FranchiseLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Rutas de Camion</h1>
            <p className="text-sm text-[#404040] mt-1">Gestion de rutas de entrega semanales</p>
          </div>
          <Button onClick={() => setCreateDialog(true)} className="bg-[#C8102E] hover:bg-[#9B0B22]">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Ruta
          </Button>
        </div>

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
              const cfg = statusConfig[route.status];
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
    </FranchiseLayout>
  );
}