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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Send, AlertCircle, Package, Copy, Check, User, FileText, Zap } from "lucide-react";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";

interface ShipmentItem {
  id: string;
  description: string;
  quantity: number;
  details: string;
}

export default function CreateShipment() {
  const navigate = useNavigate();
  const { user } = useFranchiseAuth();
  const isWarehouse = user?.franchise?.isWarehouse === 1;
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [destinationFranchiseId, setDestinationFranchiseId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ShipmentItem[]>([
    { id: "1", description: "", quantity: 1, details: "" },
  ]);
  const [error, setError] = useState("");
  const [successDialog, setSuccessDialog] = useState(false);
  const [createdTrackingNumber, setCreatedTrackingNumber] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: franchises } = trpc.franchise.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.shipment.create.useMutation({
    onSuccess: (data) => {
      utils.shipment.list.invalidate();
      utils.shipment.stats.invalidate();
      setCreatedTrackingNumber(data.trackingNumber);
      setSuccessDialog(true);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), description: "", quantity: 1, details: "" },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof ShipmentItem, value: string | number) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!senderName.trim()) {
      setError("Ingrese el nombre de la persona que envia");
      return;
    }
    if (!senderPhone.trim()) {
      setError("Ingrese el numero de telefono");
      return;
    }
    if (!destinationFranchiseId) {
      setError("Seleccione la franquicia destino");
      return;
    }

    const validItems = items.filter((item) => item.description.trim() !== "");
    if (validItems.length === 0) {
      setError("Agregue al menos un articulo con descripcion");
      return;
    }

    createMutation.mutate({
      invoiceNumber: invoiceNumber.trim() || undefined,
      senderName: senderName.trim(),
      senderPhone: senderPhone.trim(),
      destinationFranchiseId: parseInt(destinationFranchiseId),
      notes: notes.trim() || undefined,
      items: validItems.map((item) => ({
        description: item.description.trim(),
        quantity: item.quantity,
        details: item.details.trim() || undefined,
      })),
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(createdTrackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseDialog = () => {
    setSuccessDialog(false);
    navigate("/envios");
  };

  const availableFranchises = franchises?.filter((f) => !f.isWarehouse) || [];

  return (
    <FranchiseLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Crear Envio</h1>
          <p className="text-[#8A8A8A] mt-1">Registre un nuevo envio de articulos</p>
        </div>

        {isWarehouse && (
          <Card className="bg-[#FFF5F5] border-[#C8102E]/20 mb-6">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#C8102E]/10 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#C8102E]" />
              </div>
              <div>
                <p className="font-semibold text-[#9B0B22]">Envio Directo desde Bodega</p>
                <p className="text-sm text-[#C8102E]">Este envio ira directamente de Bodega a la tienda de destino sin pasar por confirmaciones intermedias.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sender Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-5 h-5 text-[#C8102E]" />
                Informacion del Remitente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="senderName">Nombre Completo *</Label>
                  <Input
                    id="senderName"
                    placeholder="Ej: Juan Perez"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderPhone">Telefono *</Label>
                  <Input
                    id="senderPhone"
                    type="tel"
                    placeholder="Ej: 8888-8888"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice & Destination */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-[#C8102E]" />
                Informacion del Envio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice">Numero de Factura (opcional)</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" />
                    <Input
                      id="invoice"
                      placeholder="Ej: FAC-001234"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="h-11 pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Franquicia Destino *</Label>
                  <Select value={destinationFranchiseId} onValueChange={setDestinationFranchiseId}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Seleccione destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFranchises.map((franchise) => (
                        <SelectItem key={franchise.id} value={franchise.id.toString()}>
                          {franchise.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Instrucciones o informacion adicional..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-[#C8102E]" />
                Articulos ({items.length})
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-4 border border-[#F0F0F0] rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#8A8A8A]">
                      Articulo #{index + 1}
                    </span>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2 space-y-2">
                      <Label className="text-xs">Descripcion *</Label>
                      <Input
                        placeholder="Ej: Zapatos Nike talla 42"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Cantidad</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Detalles (opcional)</Label>
                      <Input
                        placeholder="Color, talla, etc."
                        value={item.details}
                        onChange={(e) => updateItem(item.id, "details", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              type="submit"
              className="flex-1 h-12 bg-[#C8102E] hover:bg-[#9B0B22]"
              disabled={createMutation.isPending}
            >
              <Send className="w-5 h-5 mr-2" />
              {createMutation.isPending ? "Creando envio..." : "Crear Envio"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 px-8"
              onClick={() => navigate("/dashboard")}
            >
              Cancelar
            </Button>
          </div>
        </form>

        {/* Success Dialog with Tracking Number */}
        <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center text-xl">Envio Creado Exitosamente</DialogTitle>
            </DialogHeader>
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-[#525252]">
                El envio ha sido registrado. Comparta este numero de rastreo con el cliente:
              </p>
              <div className="bg-[#F7F7F7] border border-[#F0F0F0] rounded-lg p-4">
                <p className="text-xs text-[#8A8A8A] mb-1">Numero de Rastreo</p>
                <div className="flex items-center justify-center gap-3">
                  <code className="text-2xl font-bold text-[#C8102E] tracking-wide">
                    {createdTrackingNumber}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-8 w-8 p-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-[#A3A3A3]" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-[#A3A3A3]">
                El cliente puede usar este numero para rastrear su envio desde la pagina principal.
              </p>
            </div>
            <Button onClick={handleCloseDialog} className="w-full bg-[#C8102E] hover:bg-[#9B0B22]">
              Ver Mis Envios
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </FranchiseLayout>
  );
}