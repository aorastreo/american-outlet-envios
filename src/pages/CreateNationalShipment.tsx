import { useState } from "react";
import { useNavigate } from "react-router";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, AlertCircle, Package, User, Phone, MapPin, FileText, CreditCard } from "lucide-react";

const PROVINCIAS = [
  "San Jose",
  "Alajuela",
  "Cartago",
  "Heredia",
  "Guanacaste",
  "Puntarenas",
  "Limon",
];

const PACKAGE_SIZES = [
  { value: "PEQUENO", label: "Pequeno - ¢1,000", price: 1000 },
  { value: "MEDIANO", label: "Mediano - ¢3,500", price: 3500 },
  { value: "GRANDE", label: "Grande - ¢6,500", price: 6500 },
];

const PAYMENT_METHODS = [
  { value: "PAGA_ORIGEN", label: "Paga en origen" },
  { value: "COBRA_DESTINO", label: "Cobrar en destino" },
];

export default function CreateNationalShipment() {
  const navigate = useNavigate();
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [province, setProvince] = useState("");
  const [canton, setCanton] = useState("");
  const [district, setDistrict] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [packageSize, setPackageSize] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [error, setError] = useState("");

  const utils = trpc.useUtils();

  const createMutation = trpc.nationalShipping.create.useMutation({
    onSuccess: () => {
      utils.nationalShipping.list.invalidate();
      navigate("/envios-nacionales?creado=exito");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!receiverName || !receiverPhone || !province || !canton || !district || !deliveryAddress || !description || !packageSize || !paymentMethod) {
      setError("Por favor complete todos los campos obligatorios");
      return;
    }

    createMutation.mutate({
      receiverName,
      receiverPhone,
      province,
      canton,
      district,
      deliveryAddress,
      description,
      notes: notes || undefined,
      packageSize: packageSize as "PEQUENO" | "MEDIANO" | "GRANDE",
      paymentMethod: paymentMethod as "PAGA_ORIGEN" | "COBRA_DESTINO",
    });
  };

  const selectedPackage = PACKAGE_SIZES.find((p) => p.value === packageSize);

  return (
    <FranchiseLayout>
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-md">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
            <CardTitle className="text-xl flex items-center gap-2">
              <Package className="h-5 w-5" />
              Nuevo Envio Nacional
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receiverName" className="flex items-center gap-1">
                  <User className="h-4 w-4 text-blue-600" />
                  Nombre completo del destinatario *
                </Label>
                <Input
                  id="receiverName"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="Nombre y apellidos"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiverPhone" className="flex items-center gap-1">
                  <Phone className="h-4 w-4 text-blue-600" />
                  Telefono *
                </Label>
                <Input
                  id="receiverPhone"
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  placeholder="8888-8888"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  Provincia *
                </Label>
                <Select value={province} onValueChange={setProvince}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione una provincia" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCIAS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="canton">Canton *</Label>
                  <Input
                    id="canton"
                    value={canton}
                    onChange={(e) => setCanton(e.target.value)}
                    placeholder="Canton"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="district">Distrito *</Label>
                  <Input
                    id="district"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="Distrito"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryAddress" className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  Direccion exacta de entrega *
                </Label>
                <Textarea
                  id="deliveryAddress"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Senas exactas para la entrega"
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="flex items-center gap-1">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Contenido del articulo *
                </Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Que contiene el paquete"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas adicionales (opcional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instrucciones especiales, horario de entrega, etc."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Package className="h-4 w-4 text-blue-600" />
                  Tarifa de envio *
                </Label>
                <Select value={packageSize} onValueChange={setPackageSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione el tamano" />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGE_SIZES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPackage && (
                  <p className="text-sm text-green-600 font-medium">
                    Tarifa: ¢{selectedPackage.price.toLocaleString()}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  Metodo de pago *
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione metodo de pago" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/envios-nacionales")}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {createMutation.isPending ? "Guardando..." : "Guardar Envio"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </FranchiseLayout>
  );
}
