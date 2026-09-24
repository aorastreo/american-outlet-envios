import { useState } from "react";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ShieldCheck,
  Plus,
  Package,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Wrench,
  RotateCcw,
  ClipboardCheck,
  X,
} from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  CREADA: { label: "Creada", color: "bg-gray-100 text-gray-700", icon: Package },
  ENVIADO_A_CEDI: { label: "Enviado a CEDI", color: "bg-blue-50 text-blue-700", icon: ArrowRight },
  RECIBIDO_EN_CEDI: { label: "Recibido en CEDI", color: "bg-purple-50 text-purple-700", icon: ClipboardCheck },
  EN_REPARACION: { label: "En Reparacion", color: "bg-amber-50 text-amber-700", icon: Wrench },
  REPARADO: { label: "Reparado", color: "bg-emerald-50 text-emerald-700", icon: CheckCircle },
  ENVIADO_A_TIENDA: { label: "Enviado a Tienda", color: "bg-blue-50 text-blue-700", icon: ArrowLeft },
  RECIBIDO_EN_TIENDA: { label: "Recibido en Tienda", color: "bg-purple-50 text-purple-700", icon: ClipboardCheck },
  ENTREGADO_AL_CLIENTE: { label: "Entregado al Cliente", color: "bg-green-50 text-green-700", icon: CheckCircle },
};

const storeActions: Record<string, { next: string; label: string; color: string }> = {
  CREADA: { next: "ENVIADO_A_CEDI", label: "Enviar a CEDI", color: "bg-blue-600 hover:bg-blue-700" },
  RECIBIDO_EN_TIENDA: { next: "ENTREGADO_AL_CLIENTE", label: "Entregar al Cliente", color: "bg-green-600 hover:bg-green-700" },
};

const cediActions: Record<string, { next: string; label: string; color: string }> = {
  ENVIADO_A_CEDI: { next: "RECIBIDO_EN_CEDI", label: "Recibir en CEDI", color: "bg-purple-600 hover:bg-purple-700" },
  RECIBIDO_EN_CEDI: { next: "EN_REPARACION", label: "Iniciar Reparacion", color: "bg-amber-600 hover:bg-amber-700" },
  EN_REPARACION: { next: "REPARADO", label: "Marcar Reparado", color: "bg-emerald-600 hover:bg-emerald-700" },
  REPARADO: { next: "ENVIADO_A_TIENDA", label: "Enviar a Tienda", color: "bg-blue-600 hover:bg-blue-700" },
};

export default function WarrantiesPage() {
  const { user } = useFranchiseAuth();
  const utils = trpc.useUtils();
  const isWarehouse = user?.franchise?.isWarehouse === 1;
  const isCedi = user?.franchise?.name?.toLowerCase().includes("cedi");

  const { data: warranties, isLoading } = trpc.warranty.list.useQuery();
  const { data: stats } = trpc.warranty.stats.useQuery();
  const createMutation = trpc.warranty.create.useMutation({
    onSuccess: () => {
      toast.success("Garantia creada exitosamente");
      utils.warranty.list.invalidate();
      utils.warranty.stats.invalidate();
      setShowForm(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.warranty.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Estado actualizado");
      utils.warranty.list.invalidate();
      utils.warranty.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    invoiceNumber: "",
    senderName: "",
    senderPhone: "",
    productDescription: "",
    defectDescription: "",
    notes: "",
  });

  const resetForm = () => {
    setForm({
      invoiceNumber: "",
      senderName: "",
      senderPhone: "",
      productDescription: "",
      defectDescription: "",
      notes: "",
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.invoiceNumber || !form.senderName || !form.senderPhone || !form.productDescription || !form.defectDescription) {
      toast.error("Complete todos los campos requeridos");
      return;
    }
    createMutation.mutate(form);
  };

  const handleStatusUpdate = (id: number, status: string) => {
    updateMutation.mutate({ id, status });
  };

  const getAction = (status: string) => {
    if (isWarehouse && isCedi) return cediActions[status];
    return storeActions[status];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Garantias</h1>
          <p className="text-sm text-[#737373]">
            {isWarehouse && isCedi
              ? "Garantias recibidas para reparacion"
              : "Garantias de productos defectuosos"}
          </p>
        </div>
        {!isWarehouse && (
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#C8102E] hover:bg-[#A50D25] text-white"
          >
            {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {showForm ? "Cancelar" : "Nueva Garantia"}
          </Button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats)
            .filter(([, count]) => count > 0)
            .map(([status, count]) => {
              const config = statusConfig[status];
              const Icon = config?.icon || Package;
              return (
                <Card key={status} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config?.color || ""}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-[#1A1A1A]">{count}</p>
                        <p className="text-xs text-[#737373]">{config?.label || status}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Nueva Garantia</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#525252]">Numero de Factura *</label>
                  <Input
                    value={form.invoiceNumber}
                    onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                    placeholder="Ej: #9098"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#525252]">Telefono del Cliente *</label>
                  <Input
                    value={form.senderPhone}
                    onChange={(e) => setForm({ ...form, senderPhone: e.target.value })}
                    placeholder="Ej: 89254497"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#525252]">Nombre del Cliente *</label>
                <Input
                  value={form.senderName}
                  onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                  placeholder="Nombre completo"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#525252]">Producto *</label>
                <Input
                  value={form.productDescription}
                  onChange={(e) => setForm({ ...form, productDescription: e.target.value })}
                  placeholder="Ej: Silla ergonomica"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#525252]">Descripcion del Defecto *</label>
                <Textarea
                  value={form.defectDescription}
                  onChange={(e) => setForm({ ...form, defectDescription: e.target.value })}
                  placeholder="Describa el problema del producto"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#525252]">Notas adicionales</label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Observaciones opcionales"
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="bg-[#C8102E] hover:bg-[#A50D25] text-white" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Guardando..." : "Crear Garantia"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-[#8A8A8A]">Cargando garantias...</div>
      ) : warranties?.length === 0 ? (
        <div className="text-center py-12">
          <ShieldCheck className="w-12 h-12 text-[#D4D4D4] mx-auto mb-3" />
          <p className="text-[#8A8A8A]">No hay garantias registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {warranties?.map((warranty: any) => {
            const config = statusConfig[warranty.status] || statusConfig.CREADA;
            const Icon = config.icon;
            const action = getAction(warranty.status);

            return (
              <Card key={warranty.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="w-4 h-4 text-[#C8102E]" />
                        <span className="font-bold text-[#1A1A1A]">{warranty.trackingNumber}</span>
                        <Badge className={config.color}>
                          <Icon className="w-3 h-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-[#525252] font-medium">{warranty.senderName}</p>
                      <p className="text-xs text-[#737373]">Tel: {warranty.senderPhone}</p>
                      <p className="text-xs text-[#737373]">Factura: {warranty.invoiceNumber}</p>
                      <p className="text-sm text-[#1A1A1A] mt-1">
                        <span className="font-medium">Producto:</span> {warranty.productDescription}
                      </p>
                      <p className="text-sm text-[#525252]">
                        <span className="font-medium">Defecto:</span> {warranty.defectDescription}
                      </p>
                      {warranty.notes && (
                        <p className="text-xs text-[#8A8A8A] mt-1">Notas: {warranty.notes}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-[#8A8A8A]">
                        <span>Tienda: {warranty.originFranchise?.name || "-"}</span>
                        <span>Ubicacion actual: {warranty.currentLocation?.name || "-"}</span>
                        <span>{new Date(warranty.createdAt).toLocaleDateString("es-CR")}</span>
                      </div>
                    </div>
                    {action && (
                      <div className="shrink-0">
                        <Button
                          onClick={() => handleStatusUpdate(warranty.id, action.next)}
                          className={`${action.color} text-white`}
                          disabled={updateMutation.isPending}
                        >
                          {action.label}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
