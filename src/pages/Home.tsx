import { useState, useMemo } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search, Package, Truck, Warehouse,
  CheckCircle, MapPin, Clock, AlertTriangle,
  LogIn, User, Phone, Barcode,
  Send, ClipboardCheck, Zap,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const logoUrl = "/logo.jpg";

export default function Home() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [searchedTracking, setSearchedTracking] = useState("");

  const {
    data: shipment,
    isLoading,
    isError,
  } = trpc.shipment.track.useQuery(
    { trackingNumber: searchedTracking },
    { enabled: searchedTracking.length > 0, retry: false }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingNumber.trim()) {
      setSearchedTracking(trackingNumber.trim().toUpperCase());
    }
  };

  const statusConfig: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    CREADO: { color: "bg-slate-100 text-[#1A1A1A]", label: "Creado", icon: Package },
    ENVIADO_A_BODEGA: { color: "bg-amber-50 text-[#B8860B]", label: "Enviado a Bodega", icon: Send },
    RECIBIDO_EN_BODEGA: { color: "bg-purple-50 text-purple-700", label: "Recibido en Bodega", icon: ClipboardCheck },
    ENVIADO_A_DESTINO: { color: "bg-[#FFF5F5] text-[#C8102E]", label: "Enviado a Destino", icon: Truck },
    RECIBIDO_EN_DESTINO: { color: "bg-emerald-50 text-[#1B6B3E]", label: "Entregado", icon: CheckCircle },
    CANCELADO: { color: "bg-red-50 text-red-700", label: "Cancelado", icon: AlertTriangle },
  };

  const originIsWarehouse = useMemo(() => {
    return shipment?.originFranchise?.isWarehouse === 1;
  }, [shipment]);

  const timelineSteps = useMemo(() => {
    if (originIsWarehouse) {
      return [
        { status: "CREADO", label: "Creado", desc: "Envio registrado" },
        { status: "ENVIADO_A_DESTINO", label: "Enviado a Destino", desc: "Bodega envio a tienda" },
        { status: "RECIBIDO_EN_DESTINO", label: "Entregado", desc: "Tienda recibio" },
      ];
    }
    return [
      { status: "CREADO", label: "Creado", desc: "Envio registrado" },
      { status: "ENVIADO_A_BODEGA", label: "Enviado a Bodega", desc: "Tienda envio a bodega" },
      { status: "RECIBIDO_EN_BODEGA", label: "En Bodega", desc: "Bodega recibio" },
      { status: "ENVIADO_A_DESTINO", label: "Enviado a Destino", desc: "Bodega envio a tienda" },
      { status: "RECIBIDO_EN_DESTINO", label: "Entregado", desc: "Tienda recibio" },
    ];
  }, [originIsWarehouse]);

  const currentStepIndex = shipment
    ? timelineSteps.findIndex((s) => s.status === shipment.status)
    : -1;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt="American Outlet"
              className="w-11 h-11 rounded-xl object-contain bg-white shadow-sm"
            />
            <div>
              <h1 className="font-bold text-lg text-[#1A1A1A] leading-tight">
                American Outlet
              </h1>
              <p className="text-[11px] text-[#8A8A8A] uppercase tracking-wider">
                Sistema de Envios
              </p>
            </div>
          </div>
          <Link to="/login">
            <Button
              variant="outline"
              className="gap-2 border-[#C8102E] text-[#C8102E] hover:bg-[#FFF5F5]"
            >
              <LogIn className="w-4 h-4" />
              Acceso Franquicias
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FFF5F5] rounded-2xl mb-5">
            <Barcode className="w-8 h-8 text-[#C8102E]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1A1A1A] mb-3">
            Rastree su Envio
          </h2>
          <p className="text-base text-[#8A8A8A] max-w-xl mx-auto">
            Ingrese su numero de rastreo para conocer el estado actual de su
            envio entre nuestras franquicias.
          </p>
        </div>

        {/* Search */}
        <Card className="max-w-2xl mx-auto mb-12 border-[#D4D4D4] shadow-sm">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A3A3A3]" />
                <Input
                  placeholder="Ej: AO84729153X"
                  value={trackingNumber}
                  onChange={(e) =>
                    setTrackingNumber(e.target.value.toUpperCase())
                  }
                  className="pl-12 h-12 text-lg font-mono tracking-wide border-[#D4D4D4] focus:ring-[#C8102E] focus:border-[#C8102E]"
                />
              </div>
              <Button
                type="submit"
                className="h-12 px-8 bg-[#C8102E] hover:bg-[#9B0B22] text-white"
                disabled={isLoading || !trackingNumber.trim()}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Rastrear
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error */}
        {isError && (
          <Card className="max-w-2xl mx-auto border-red-200 mb-12">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-[#1A1A1A] font-medium">
                No se encontro ningun envio con ese numero de rastreo
              </p>
              <p className="text-sm text-[#8A8A8A] mt-1">
                Verifique el numero e intente nuevamente
              </p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {shipment && (
          <div className="max-w-4xl mx-auto space-y-6 mb-12">
            {/* Tracking Banner */}
            <div className="bg-[#C8102E] text-white rounded-xl p-6 text-center shadow-sm">
              <p className="text-white/80 text-sm mb-1">
                Numero de Rastreo
              </p>
              <p className="text-3xl font-bold font-mono tracking-wider">
                {shipment.trackingNumber}
              </p>
            </div>

            {/* Direct flow badge */}
            {originIsWarehouse && (
              <Card className="bg-[#FFF5F5] border-[#C8102E]/20">
                <CardContent className="p-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#C8102E]" />
                  <span className="text-sm text-[#C8102E] font-medium">
                    Envio Directo desde Bodega - Flujo acelerado (Bodega →
                    Tienda)
                  </span>
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            <Card className="border-[#D4D4D4] shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      {shipment.invoiceNumber && (
                        <p className="text-sm text-[#8A8A8A]">
                          Factura: #{shipment.invoiceNumber}
                        </p>
                      )}
                      {(() => {
                        const cfg = statusConfig[shipment.status];
                        return cfg ? (
                          <Badge
                            variant="secondary"
                            className={cfg.color}
                          >
                            <cfg.icon className="w-3 h-3 mr-1" />
                            {cfg.label}
                          </Badge>
                        ) : null;
                      })()}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-[#525252] flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4 text-[#C8102E]" />
                        {shipment.senderName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4 text-[#C8102E]" />
                        {shipment.senderPhone}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-[#525252] flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-[#C8102E]" />
                        De: {shipment.originFranchise?.displayName}
                      </span>
                      <span className="text-[#D4D4D4]">→</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-[#C8102E]" />
                        Para: {shipment.destinationFranchise?.displayName}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#A3A3A3]">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {shipment.createdAt
                        ? format(
                            new Date(shipment.createdAt),
                            "dd/MM/yyyy HH:mm",
                            { locale: es }
                          )
                        : "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="border-[#D4D4D4] shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-semibold text-[#1A1A1A] mb-6">
                  Progreso del Envio
                </h3>
                <div className="relative">
                  <div className="flex items-center justify-between">
                    {timelineSteps.map((step, index) => {
                      const isCompleted = index <= currentStepIndex;
                      const isCurrent = index === currentStepIndex;
                      return (
                        <div
                          key={step.status}
                          className="flex flex-col items-center relative z-10 flex-1"
                        >
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
                              isCompleted
                                ? "bg-[#C8102E] border-[#C8102E] text-white"
                                : "bg-white border-[#D4D4D4] text-[#A3A3A3]"
                            } ${isCurrent ? "ring-4 ring-[#C8102E]/20" : ""}`}
                          >
                            {step.status === "RECIBIDO_EN_DESTINO" ? (
                              <CheckCircle className="w-6 h-6" />
                            ) : step.status === "RECIBIDO_EN_BODEGA" ? (
                              <ClipboardCheck className="w-6 h-6" />
                            ) : step.status === "CREADO" ? (
                              <Package className="w-6 h-6" />
                            ) : (
                              <Truck className="w-6 h-6" />
                            )}
                          </div>
                          <span
                            className={`text-xs mt-3 text-center font-medium ${
                              isCompleted
                                ? "text-[#1A1A1A]"
                                : "text-[#A3A3A3]"
                            }`}
                          >
                            {step.label}
                          </span>
                          <span
                            className={`text-[10px] text-center ${
                              isCompleted
                                ? "text-[#8A8A8A]"
                                : "text-[#A3A3A3]"
                            }`}
                          >
                            {step.desc}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="absolute top-6 left-0 right-0 h-1 bg-[#F0F0F0] -z-0 mx-8">
                    <div
                      className="h-full bg-[#C8102E] transition-all duration-500"
                      style={{
                        width: `${Math.max(
                          0,
                          (currentStepIndex /
                            (timelineSteps.length - 1)) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items & History */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-[#D4D4D4] shadow-sm">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-[#1A1A1A] mb-4">
                    Articulos ({shipment.items?.length || 0})
                  </h3>
                  <div className="space-y-3">
                    {shipment.items?.map((item: { id: number; description: string; quantity: number; details?: string | null }) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-[#F7F7F7] rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-[#1A1A1A]">
                            {item.description}
                          </p>
                          {item.details && (
                            <p className="text-sm text-[#8A8A8A]">
                              {item.details}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary">
                          x{item.quantity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#D4D4D4] shadow-sm">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-[#1A1A1A] mb-4">
                    Historial
                  </h3>
                  <div className="relative pl-6">
                    <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-[#F0F0F0]" />
                    <div className="space-y-5">
                      {shipment.tracking?.map(
                        (
                          track: {
                            id: number;
                            status: string;
                            notes?: string | null;
                            createdAt: Date;
                          },
                          index: number
                        ) => {
                          const cfg = statusConfig[track.status];
                          return (
                            <div key={track.id} className="relative">
                              <div
                                className={`absolute -left-4 w-3 h-3 rounded-full border-2 ${
                                  index === 0
                                    ? "bg-[#C8102E] border-[#C8102E]"
                                    : "bg-white border-[#D4D4D4]"
                                }`}
                              />
                              <div className="ml-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {cfg && (
                                    <Badge
                                      variant="secondary"
                                      className={cfg.color}
                                    >
                                      <cfg.icon className="w-3 h-3 mr-1" />
                                      {cfg.label}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-[#A3A3A3]">
                                    {track.createdAt
                                      ? format(
                                          new Date(track.createdAt),
                                          "dd/MM HH:mm",
                                          { locale: es }
                                        )
                                      : "-"}
                                  </span>
                                </div>
                                {track.notes && (
                                  <p className="text-sm text-[#525252] mt-1">
                                    {track.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Info Section */}
        {!shipment && !isError && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: Package,
                title: "Cree el Envio",
                desc: "Su tienda registra los articulos, datos del remitente y genera el numero de rastreo.",
              },
              {
                icon: Send,
                title: "Envio a Bodega",
                desc: "La tienda origen confirma que envio el paquete hacia la bodega central.",
              },
              {
                icon: Warehouse,
                title: "Bodega Central",
                desc: "La bodega recibe, verifica y reenvia el paquete hacia su destino final.",
              },
              {
                icon: CheckCircle,
                title: "Entregado",
                desc: "La tienda destino confirma la recepcion y el envio esta completo.",
              },
            ].map((step) => (
              <Card
                key={step.title}
                className="text-center border-[#D4D4D4] shadow-sm hover:border-[#C8102E]/30 transition-colors"
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-[#FFF5F5] rounded-xl flex items-center justify-center mx-auto mb-4">
                    <step.icon className="w-6 h-6 text-[#C8102E]" />
                  </div>
                  <h3 className="font-semibold text-[#1A1A1A] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#8A8A8A]">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-[#F0F0F0] bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-[#A3A3A3]">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src={logoUrl} alt="" className="w-3 h-3 object-contain" />
            <span className="font-medium text-[#1A1A1A]">
              American Outlet
            </span>
          </div>
          <p className="text-xs">
            Sistema de Envios y Rastreo entre Franquicias
          </p>
        </div>
      </footer>
    </div>
  );
}
