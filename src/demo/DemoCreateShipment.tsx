import { useState } from "react";
import { useNavigate } from "react-router";
import { useDemoAuth } from "./useDemoAuth";
import { useDemoCreate } from "./useDemoApi";
import { FRANCHISES } from "./data";
import { User, Phone, Package, ArrowLeft, Send, FileText } from "lucide-react";

interface Item { id: string; description: string; quantity: number; details: string; }

export default function DemoCreateShipment() {
  const navigate = useNavigate();
  const { user } = useDemoAuth();
  const { create, isPending } = useDemoCreate();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [destinationFranchiseId, setDestinationFranchiseId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([{ id: "1", description: "", quantity: 1, details: "" }]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isWarehouse = user?.franchise?.isWarehouse === 1;
  const availableFranchises = FRANCHISES.filter((f) => !f.isWarehouse && (isWarehouse || f.id !== user?.franchiseId));

  const addItem = () => setItems([...items, { id: Date.now().toString(), description: "", quantity: 1, details: "" }]);
  const removeItem = (id: string) => { if (items.length <= 1) return; setItems(items.filter((i) => i.id !== id)); };
  const updateItem = (id: string, field: keyof Item, value: string | number) => setItems(items.map((i) => i.id === id ? { ...i, [field]: value } : i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!senderName.trim()) { setError("Ingrese el nombre del remitente"); return; }
    if (!senderPhone.trim()) { setError("Ingrese el telefono"); return; }
    if (!destinationFranchiseId) { setError("Seleccione la franquicia destino"); return; }
    const validItems = items.filter((i) => i.description.trim() !== "");
    if (validItems.length === 0) { setError("Agregue al menos un articulo"); return; }

    const result = create({
      invoiceNumber: invoiceNumber.trim() || undefined,
      senderName: senderName.trim(),
      senderPhone: senderPhone.trim(),
      destinationFranchiseId: parseInt(destinationFranchiseId),
      notes: notes.trim() || undefined,
      items: validItems.map((i) => ({ description: i.description.trim(), quantity: i.quantity, details: i.details.trim() || undefined })),
    });

    if (result.success) {
      setSuccess(result.trackingNumber);
      setSenderName(""); setSenderPhone(""); setInvoiceNumber(""); setNotes(""); setDestinationFranchiseId(""); setItems([{ id: "1", description: "", quantity: 1, details: "" }]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-[#8A8A8A] hover:text-[#C8102E] mb-4"><ArrowLeft className="w-4 h-4" />Volver</button>
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-1">Crear Envio</h1>
      <p className="text-[#8A8A8A] mb-6">Registre un nuevo envio de articulos</p>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 text-center">
          <p className="text-emerald-700 font-semibold mb-2">Envio creado exitosamente!</p>
          <p className="text-sm text-emerald-600 mb-2">Numero de rastreo:</p>
          <code className="text-2xl font-bold text-[#C8102E] tracking-wide bg-white px-4 py-2 rounded-lg inline-block">{success}</code>
          <div className="mt-3 flex gap-2 justify-center">
            <button onClick={() => { navigator.clipboard.writeText(success); }} className="text-xs text-[#C8102E] underline">Copiar</button>
            <button onClick={() => setSuccess("")} className="text-xs text-[#8A8A8A]">Crear otro</button>
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700 flex items-center gap-2"><span className="font-bold">Error:</span>{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-[#D4D4D4] rounded-lg p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><User className="w-5 h-5 text-[#C8102E]" />Informacion del Remitente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium mb-1 block">Nombre Completo <span className="text-red-500">*</span></label><input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Ej: Juan Perez" className="w-full h-10 px-3 rounded-lg border border-[#D4D4D4] text-sm focus:ring-[#C8102E] focus:border-[#C8102E] outline-none" /></div>
            <div><label className="text-sm font-medium mb-1 block">Telefono <span className="text-red-500">*</span></label><input value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} placeholder="Ej: 8888-8888" className="w-full h-10 px-3 rounded-lg border border-[#D4D4D4] text-sm focus:ring-[#C8102E] focus:border-[#C8102E] outline-none" /></div>
          </div>
        </div>

        <div className="bg-white border border-[#D4D4D4] rounded-lg p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Send className="w-5 h-5 text-[#C8102E]" />Informacion del Envio</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium mb-1 block">Numero de Factura (opcional)</label><div className="relative"><FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" /><input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Ej: FAC-001234" className="w-full h-10 pl-10 pr-3 rounded-lg border border-[#D4D4D4] text-sm focus:ring-[#C8102E] focus:border-[#C8102E] outline-none" /></div></div>
            <div><label className="text-sm font-medium mb-1 block">Franquicia Destino <span className="text-red-500">*</span></label><select value={destinationFranchiseId} onChange={(e) => setDestinationFranchiseId(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[#D4D4D4] text-sm focus:ring-[#C8102E] focus:border-[#C8102E] outline-none"><option value="">Seleccione destino</option>{availableFranchises.map((f) => (<option key={f.id} value={f.id}>{f.displayName}</option>))}</select></div>
          </div>
          <div><label className="text-sm font-medium mb-1 block">Notas (opcional)</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instrucciones o informacion adicional..." rows={2} className="w-full px-3 py-2 rounded-lg border border-[#D4D4D4] text-sm focus:ring-[#C8102E] focus:border-[#C8102E] outline-none resize-none" /></div>
        </div>

        <div className="bg-white border border-[#D4D4D4] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between"><h3 className="font-semibold flex items-center gap-2"><Package className="w-5 h-5 text-[#C8102E]" />Articulos ({items.length})</h3><button type="button" onClick={addItem} className="text-sm text-[#C8102E] font-medium hover:underline">+ Agregar</button></div>
          {items.map((item, idx) => (
            <div key={item.id} className="p-4 bg-[#F7F7F7] rounded-lg space-y-3">
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-[#8A8A8A]">Articulo #{idx + 1}</span>{items.length > 1 && <button type="button" onClick={() => removeItem(item.id)} className="text-xs text-red-500 hover:text-red-700">Eliminar</button>}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2"><label className="text-xs text-[#8A8A8A] mb-1 block">Descripcion <span className="text-red-500">*</span></label><input value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} placeholder="Ej: Zapatos Nike" className="w-full h-10 px-3 rounded-lg border border-[#D4D4D4] text-sm focus:ring-[#C8102E] focus:border-[#C8102E] outline-none" /></div>
                <div><label className="text-xs text-[#8A8A8A] mb-1 block">Cantidad</label><input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)} className="w-full h-10 px-3 rounded-lg border border-[#D4D4D4] text-sm focus:ring-[#C8102E] focus:border-[#C8102E] outline-none" /></div>
              </div>
              <div><label className="text-xs text-[#8A8A8A] mb-1 block">Detalles (opcional)</label><input value={item.details} onChange={(e) => updateItem(item.id, "details", e.target.value)} placeholder="Color, talla, etc." className="w-full h-10 px-3 rounded-lg border border-[#D4D4D4] text-sm focus:ring-[#C8102E] focus:border-[#C8102E] outline-none" /></div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={isPending} className="flex-1 h-12 bg-[#C8102E] hover:bg-[#9B0B22] text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50">
            {isPending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4" />Crear Envio</>}
          </button>
          <button type="button" onClick={() => navigate("/envios")} className="px-6 h-12 border border-[#D4D4D4] rounded-lg text-sm font-medium text-[#8A8A8A] hover:bg-[#F7F7F7]">Cancelar</button>
        </div>
      </form>
    </div>
  );
}
