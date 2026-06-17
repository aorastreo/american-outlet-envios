import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Truck, CheckCircle, MapPin, User, Search, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function TransportDelivery() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [deliveredTo, setDeliveredTo] = useState("");
  const [notes, setNotes] = useState("");
  const [searchedTracking, setSearchedTracking] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { data: shipment, isLoading } = trpc.nationalShipping.track.useQuery(
    { trackingNumber: searchedTracking },
    { enabled: searchedTracking.length > 0, retry: false }
  );

  const markDeliveredMutation = trpc.nationalShipping.markDelivered.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setSearchedTracking("");
      setTrackingNumber("");
      setDeliveredTo("");
      setNotes("");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (trackingNumber.trim()) {
      setSearchedTracking(trackingNumber.trim().toUpperCase());
    }
  };

  const handleDeliver = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!deliveredTo.trim()) {
      setError("Ingrese el nombre de quien recibio");
      return;
    }
    if (!shipment) return;
    markDeliveredMutation.mutate({
      trackingNumber: shipment.trackingNumber,
      deliveredTo: deliveredTo.trim(),
      notes: notes || undefined,
    });
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    CREADO: { color: "bg-slate-100 text-[#1A1A1A]", label: "Creado" },
    SOLICITADO_RECOLECCION: { color: "bg-amber-100 text-amber-700", label: "Solicitado Recoleccion" },
    RECOLECTADO: { color: "bg-blue-100 text-blue-700", label: "En Transito" },
    ENTREGADO: { color: "bg-emerald-100 text-emerald-700", label: "Entregado" },
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-[#1A1A1A]">¡Entrega Confirmada!</h2>
            <p className="text-[#8A8A8A]">El envio ha sido marcado como entregado exitosamente.</p>
            <Button onClick={() => setSuccess(false)} className="w-full bg-[#C8102E] hover:bg-[#9B0B22]">
              Entregar Otro Paquete
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] p-4">
      <div className="max-w-md mx-auto space-y-6 pt-8">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-[#C8102E] rounded-xl flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Confirmar Entrega</h1>
          <p className="text-[#8A8A8A] mt-1">Transportista</p>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A3A3A3]" />
                <Input
                  placeholder="Ej: AN12345678A"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
                  className="pl-12 h-12 text-lg font-mono"
                />
              </div>
              <Button type="submit" className="h-12 px-6 bg-[#C8102E] hover:bg-[#9B0B22]" disabled={isLoading}>
                {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-5 h-5" />}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Shipment Details */}
        {shipment && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="text-center pb-4 border-b border-[#F0F0F0]">
                <p className="text-sm text-[#8A8A8A]">Numero de Guia</p>
                <p className="text-2xl font-bold font-mono text-[#1A1A1A]">{shipment.trackingNumber}</p>
                <Badge variant="secondary" className={`mt-2 ${statusConfig[shipment.status]?.color}`}>
                  {statusConfig[shipment.status]?.label || shipment.status}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-[#C8102E]" />
                  <div>
                    <p className="text-sm text-[#8A8A8A]">Destinatario</p>
                    <p className="font-medium">{shipment.receiverName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-[#C8102E]" />
                  <div>
                    <p className="text-sm text-[#8A8A8A]">Entregar en</p>
                    <p className="font-medium">{shipment.province}, {shipment.canton}, {shipment.district}</p>
                  </div>
                </div>
              </div>

              {shipment.status === "RECOLECTADO" && (
                <form onSubmit={handleDeliver} className="space-y-4 pt-4 border-t border-[#F0F0F0]">
                  <div className="space-y-2">
                    <Label>Nombre de quien recibio *</Label>
                    <Input
                      value={deliveredTo}
                      onChange={(e) => setDeliveredTo(e.target.value)}
                      placeholder="Ej: Maria Fernandez"
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notas (opcional)</Label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ej: Entregado a vecino"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-14 bg-[#1B6B3E] hover:bg-[#145a32] text-lg"
                    disabled={markDeliveredMutation.isPending}
                  >
                    {markDeliveredMutation.isPending ? "Confirmando..." : (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Confirmar Entrega
                      </>
                    )}
                  </Button>
                </form>
              )}

              {shipment.status === "ENTREGADO" && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                  <p className="text-emerald-700 font-medium">Este envio ya fue entregado</p>
                  {shipment.deliveredTo && <p className="text-sm text-emerald-600 mt-1">Recibido por: {shipment.deliveredTo}</p>}
                </div>
              )}

              {shipment.status !== "RECOLECTADO" && shipment.status !== "ENTREGADO" && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <p className="text-amber-700 font-medium">Este envio aun no esta listo para entregar</p>
                  <p className="text-sm text-amber-600 mt-1">Estado actual: {statusConfig[shipment.status]?.label}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}