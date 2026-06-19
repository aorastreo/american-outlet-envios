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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, MapPin, Phone, User, FileText, DollarSign, Copy, Check, Truck } from "lucide-react";

// Datos completos de Costa Rica
const COSTA_RICA_DATA: Record<string, Record<string, string[]>> = {
  "San José": {
    "San José": ["Carmen", "Merced", "Hospital", "Catedral", "Zapote", "San Francisco de Dos Ríos", "Uruca", "Mata Redonda", "Pavas", "Hatillo", "San Sebastián"],
    "Escazú": ["Escazú Centro", "San Rafael", "San Antonio"],
    "Desamparados": ["Desamparados", "San Miguel", "San Juan de Dios", "San Rafael Arriba", "San Rafael Abajo", "San Antonio", "Frailes", "Patarrá", "San Cristóbal", "Rosario", "Damas", "San Rafael", "Gravilias", "Los Guido"],
    "Puriscal": ["Santiago", "Barbacoas", "Grifo Alto", "San Rafael", "Candelarita", "Desamparaditos", "San Antonio", "Chires"],
    "Tarrazú": ["San Marcos", "San Lorenzo", "San Carlos"],
    "Aserrí": ["Aserrí", "Tarbaca", "Vuelta de Jorco", "San Gabriel", "Legua", "Monterrey", "Salitrillos"],
    "Mora": ["Colón", "Guayabo", "Tabarcia", "Piedras Negras", "Picagres", "Jaris", "Quitirrisí"],
    "Goicoechea": ["San José", "Guadalupe", "San Francisco", "Calle Blancos", "Mata de Plátano", "Ipís", "Rancho Redondo", "Purral"],
    "Santa Ana": ["Santa Ana", "Salitral", "Pozos", "Uruca", "Piedades", "Brasil"],
    "Alajuelita": ["Alajuelita", "San Josecito", "San Antonio", "Concepción", "San Felipe"],
    "Vázquez de Coronado": ["San Isidro", "San Rafael", "Dulce Nombre de Jesús", "Patalillo", "Cascajal"],
    "Acosta": ["San Ignacio", "Guaitil", "Palmichal", "Cangrejal", "Sabanillas"],
    "Tibás": ["San Juan", "Cinco Esquinas", "Anselmo Llorente", "León XIII", "Colima"],
    "Moravia": ["San Vicente", "San Jerónimo", "La Trinidad"],
    "Montes de Oca": ["San Pedro", "Sabanilla", "Mercedes", "San Rafael"],
    "Turrubares": ["San Pablo", "San Pedro", "San Juan de Mata", "San Luis", "Carara"],
    "Dota": ["Santa María", "Jardín", "Copey"],
    "Curridabat": ["Curridabat", "Granadilla", "Sánchez", "Tirrases"],
    "Pérez Zeledón": ["San Isidro de El General", "El General", "Daniel Flores", "Rivas", "San Pedro", "Platanares", "Pejibaye", "Cajón", "Barú", "Río Nuevo", "Páramo", "La Cuesta"],
    "León Cortés": ["San Pablo", "San Andrés", "Llano Bonito", "San Isidro", "Santa Cruz", "San Antonio"],
  },
  "Cartago": {
    "Cartago": ["Oriental", "Occidental", "Carmen", "San Nicolás", "Agua Caliente", "Guadalupe", "Corralillo", "Tierra Blanca", "Dulce Nombre", "Llano Grande", "Quebradilla"],
    "Paraíso": ["Paraíso", "Santiago", "Orosi", "Cachí", "Llanos de Santa Lucía"],
    "La Unión": ["Tres Ríos", "San Diego", "San Juan", "San Rafael", "Concepción", "Dulce Nombre", "San Ramón", "Río Azul"],
    "Jiménez": ["Juan Viñas", "Tucurrique", "Pejibaye"],
    "Turrialba": ["Turrialba", "La Suiza", "Peralta", "Santa Cruz", "Santa Teresita", "Pavones", "Tuis", "Tayutic", "Santa Rosa", "Tres Equis", "La Isabel", "Chirripó"],
    "Alvarado": ["Pacayas", "Cervantes", "Capellades"],
    "Oreamuno": ["San Rafael", "Cot", "Potrero Cerrado", "Las Vegas", "San Isidro", "Santa Rosa"],
    "El Guarco": ["El Tejar", "San Isidro", "Tobosi", "Patio de Agua"],
  },
  "Alajuela": {
    "Alajuela": ["Alajuela", "San José", "Carrizal", "San Antonio", "Guácima", "San Isidro", "Sabanilla", "San Rafael", "Río Segundo", "Desamparados", "Turrúcares", "Tambor", "La Garita", "Sarapiquí"],
    "San Ramón": ["San Ramón", "Santiago", "San Juan", "Piedades Norte", "Piedades Sur", "San Rafael", "San Isidro", "Ángeles", "Alfaro", "Volio", "Concepción", "Zapotal", "Peñas Blancas"],
    "Grecia": ["Grecia", "San Isidro", "San José", "San Roque", "Tacares", "Río Cuarto", "Puente de Piedra", "Bolívar"],
    "San Mateo": ["San Mateo", "Desmonte", "Jesús María", "Labrador"],
    "Atenas": ["Atenas", "Jesús", "Mercedes", "San Isidro", "Concepción", "San José", "Santa Eulalia", "Escobal"],
    "Naranjo": ["Naranjo", "San Miguel", "San José", "Cirrí Sur", "San Jerónimo", "San Juan", "El Rosario", "Palmitos"],
    "Palmares": ["Palmares", "Zaragoza", "Buenos Aires", "Santiago", "Candelaria", "Esquipulas", "Granja", "San Jorge"],
    "Poás": ["San Pedro", "San Juan", "San Rafael", "Carrillos", "Sabana Redonda"],
    "Orotina": ["Orotina", "El Mastate", "Hacienda Vieja", "Coyolar", "La Ceiba"],
    "San Carlos": ["Quesada", "Florencia", "Buenavista", "Aguas Zarcas", "Venecia", "Pital", "La Fortuna", "La Tigra", "La Palmera", "Venado", "Cutris", "Monterrey", "Pocosol"],
    "Zarcero": ["Zarcero", "Laguna", "Tapezco", "Guadalupe", "Palmira", "Zapote", "Brisas"],
    "Sarchí": ["Sarchí Norte", "Sarchí Sur", "Toro Amarillo", "San Pedro", "Rodríguez"],
    "Upala": ["Upala", "Aguas Claras", "San José", "Bijagua", "Delicias", "Dos Ríos", "Yolillal", "Canalete"],
    "Los Chiles": ["Los Chiles", "Caño Negro", "El Amparo", "San Jorge"],
    "Guatuso": ["San Rafael", "Buenavista", "Cote", "Katira"],
    "Río Cuarto": ["Río Cuarto"],
  },
  "Heredia": {
    "Heredia": ["Heredia", "Mercedes", "San Francisco", "Ulloa", "Vara Blanca"],
    "Barva": ["Barva", "San Pedro", "San Pablo", "San Roque", "Santa Lucía", "San José de la Montaña"],
    "Santo Domingo": ["Santo Domingo", "San Vicente", "San Miguel", "Paracito", "Santo Tomás", "Santa Rosa", "Tures", "Pará"],
    "Santa Bárbara": ["Santa Bárbara", "San Pedro", "San Juan", "Jesús", "Santo Domingo", "Purabá"],
    "San Rafael": ["San Rafael", "San Josecito", "Santiago", "Los Ángeles", "Concepción"],
    "San Isidro": ["San Isidro", "San José", "Concepción", "San Francisco", "San Antonio"],
    "Belén": ["San Antonio", "La Ribera", "La Asunción"],
    "Flores": ["San Joaquín", "Barrantes", "Llorente"],
    "San Pablo": ["San Pablo", "Rincón de Sabanilla"],
    "Sarapiquí": ["Puerto Viejo", "La Virgen", "Las Horquetas", "Llanuras del Gaspar", "Cureña"],
  },
  "Guanacaste": {
    "Liberia": ["Liberia", "Cañas Dulces", "Mayorga", "Nacascolo", "Curubandé"],
    "Nicoya": ["Nicoya", "Mansión", "San Antonio", "Quebrada Honda", "Sámara", "Nosara", "Belén de Nosarita"],
    "Santa Cruz": ["Santa Cruz", "Bolsón", "Veintisiete de Abril", "San Roque", "Santa Elena", "Oriente", "Tamarindo", "Tempate", "Cartagena", "Cuajiniquil", "Diriá", "Cabo Velas", "Tamarindo"],
    "Bagaces": ["Bagaces", "La Fortuna", "Mogote", "Río Naranjo"],
    "Carrillo": ["Filadelfia", "Palmira", "Sardinal", "Belén"],
    "Cañas": ["Cañas", "Palmira", "San Miguel", "Bebedero", "Porozal"],
    "Abangares": ["Las Juntas", "Sierra", "San Juan", "Colorado"],
    "Tilarán": ["Tilarán", "Quebrada Grande", "Tronadora", "Santa Rosa", "Líbano", "Tierras Morenas", "Arenal"],
    "Nandayure": ["Carmona", "Santa Rita", "Zapotal", "San Pablo", "Porvenir", "Bejuco"],
    "La Cruz": ["La Cruz", "Santa Cecilia", "La Garita", "Santa Elena"],
    "Hojancha": ["Hojancha", "Monte Romo", "Puerto Carrillo", "Huacas", "Matambú"],
  },
  "Puntarenas": {
    "Puntarenas": ["Puntarenas", "Pitahaya", "Chomes", "Lepanto", "Paquera", "Manzanillo", "Guacimal", "Barranca", "Monte Verde", "Isla del Coco", "Cóbano", "Chacarita", "Chira", "Acapulco", "El Roble", "Arancibia"],
    "Esparza": ["Espíritu Santo", "San Juan Grande", "Macacona", "San Rafael", "San Jerónimo", "Caldera"],
    "Buenos Aires": ["Buenos Aires", "Volcán", "Potrero Grande", "Boruca", "Pilas", "Colinas", "Chánguena", "Biolley", "Brunka"],
    "Osa": ["Puerto Cortés", "Palmar", "Sierpe", "Bahía Ballena", "Piedras Blancas", "Bahía Drake"],
    "Golfito": ["Golfito", "Puerto Jiménez", "Guaycará", "Pavón", "San José"],
    "Coto Brus": ["San Vito", "Sabalito", "Aguabuena", "Limoncito", "Pittier", "Gutiérrez Brown"],
    "Parrita": ["Parrita"],
    "Corredores": ["Corredores", "La Cuesta", "Piedras Negras", "Canoas", "Laurel"],
    "Garabito": ["Jacó", "Tárcoles"],
    "Montes de Oro": ["Miramar", "La Unión", "San Isidro"],
    "Osa (Puerto Cortés)": ["Puerto Cortés", "Palmar", "Sierpe", "Bahía Ballena", "Piedras Blancas", "Bahía Drake"],
  },
  "Limón": {
    "Limón": ["Limón", "Valle La Estrella", "Río Blanco", "Matama"],
    "Pococí": ["Guápiles", "Jiménez", "Rita", "Roxana", "Cariari", "Colorado", "La Colonia"],
    "Siquirres": ["Siquirres", "Pacuarito", "Florida", "Germania", "Cairo", "Alegría"],
    "Talamanca": ["Bratsi", "Sixaola", "Cahuita", "Telire"],
    "Matina": ["Matina", "Batán", "Carrandi"],
    "Guácimo": ["Guácimo", "Mercedes", "Pocora", "Río Jiménez", "Duacarí"],
  },
};

const PACKAGE_SIZES = [
  { id: "PEQUENO" as const, label: "Pequeño", price: 1000, weight: "Hasta 2kg", dimensions: "30x20x15 cm", color: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100" },
  { id: "MEDIANO" as const, label: "Mediano", price: 3500, weight: "Hasta 10kg", dimensions: "50x40x30 cm", color: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" },
  { id: "GRANDE" as const, label: "Grande", price: 6500, weight: "Hasta 25kg", dimensions: "80x60x50 cm", color: "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100" },
];

export default function CreateNationalShipment() {
  const navigate = useNavigate();
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [province, setProvince] = useState("");
  const [canton, setCanton] = useState("");
  const [district, setDistrict] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [packageSize, setPackageSize] = useState<"PEQUENO" | "MEDIANO" | "GRANDE">("PEQUENO");
  const [paymentMethod, setPaymentMethod] = useState<"PAGA_ORIGEN" | "COBRA_DESTINO">("COBRA_DESTINO");
  const [error, setError] = useState("");

  const utils = trpc.useUtils();

  const selectedSize = PACKAGE_SIZES.find(s => s.id === packageSize);
  const cantones = province ? Object.keys(COSTA_RICA_DATA[province] || {}) : [];
  const distritos = province && canton ? (COSTA_RICA_DATA[province]?.[canton] || []) : [];

  const createMutation = trpc.nationalShipping.create.useMutation({
    onSuccess: () => {
      utils.nationalShipping.list.invalidate();
      navigate("/envios-nacionales");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!receiverName.trim() || !receiverPhone.trim() || !province || !canton || !district || !deliveryAddress.trim() || !description.trim()) {
      setError("Complete todos los campos obligatorios");
      return;
    }

    createMutation.mutate({
      receiverName,
      receiverPhone,
      receiverId: receiverId || undefined,
      receiverEmail: receiverEmail || undefined,
      province,
      canton,
      district,
      deliveryAddress,
      description,
      notes: notes || undefined,
      packageSize,
      paymentMethod,
    });
  };

  const handleProvinceChange = (val: string) => {
    setProvince(val);
    setCanton("");
    setDistrict("");
  };

  const handleCantonChange = (val: string) => {
    setCanton(val);
    setDistrict("");
  };

  const copyTracking = () => {
    navigator.clipboard.writeText(createdTrackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <FranchiseLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] flex items-center gap-2">
            <Truck className="w-7 h-7 text-[#C8102E]" />
            Nuevo Envío Nacional
          </h1>
          <p className="text-[#8A8A8A] mt-1">Envío a todo el país a través de empresa de transporte</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* DESTINATARIO */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-[#C8102E]" />
                Datos del Destinatario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre completo *</Label>
                  <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="María Fernández" />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono *</Label>
                  <Input value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} placeholder="8888-2222" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cédula (opcional)</Label>
                  <Input value={receiverId} onChange={(e) => setReceiverId(e.target.value)} placeholder="1-2345-6789" />
                </div>
                <div className="space-y-2">
                  <Label>Email (opcional)</Label>
                  <Input value={receiverEmail} onChange={(e) => setReceiverEmail(e.target.value)} placeholder="maria@email.com" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DIRECCION */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#C8102E]" />
                Dirección de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Provincia *</Label>
                  <Select value={province} onValueChange={handleProvinceChange}>
                    <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(COSTA_RICA_DATA).map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cantón *</Label>
                  <Select value={canton} onValueChange={handleCantonChange} disabled={!province}>
                    <SelectTrigger><SelectValue placeholder={province ? "Seleccione..." : "Primero provincia"} /></SelectTrigger>
                    <SelectContent>
                      {cantones.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Distrito *</Label>
                  <Select value={district} onValueChange={setDistrict} disabled={!canton}>
                    <SelectTrigger><SelectValue placeholder={canton ? "Seleccione..." : "Primero cantón"} /></SelectTrigger>
                    <SelectContent>
                      {distritos.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dirección exacta *</Label>
                <Textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="De la iglesia 200m sur, casa azul con portón negro" rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* CONTENIDO */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#C8102E]" />
                Contenido del Envío
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Descripción *</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="2 camisetas, 1 pantalón" rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Notas adicionales (opcional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Frágil, no doblar" rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* TAMAÑO DEL PAQUETE */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-[#C8102E]" />
                Tamaño del Paquete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {PACKAGE_SIZES.map((size) => (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => setPackageSize(size.id)}
                    className={`border-2 rounded-lg p-4 text-center transition-all ${packageSize === size.id ? size.color + " border-current ring-2 ring-current ring-offset-2" : "border-[#E5E5E5] hover:border-[#C8102E]/30"}`}
                  >
                    <p className="font-bold text-lg">{size.label}</p>
                    <p className="text-2xl font-bold mt-1">¢{size.price.toLocaleString()}</p>
                    <p className="text-xs mt-2 opacity-75">{size.weight}</p>
                    <p className="text-xs opacity-60">{size.dimensions}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* PAGO */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#C8102E]" />
                Pago
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "PAGA_ORIGEN" | "COBRA_DESTINO")} className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PAGA_ORIGEN" id="paga-origen" />
                  <Label htmlFor="paga-origen">Paga la tienda</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="COBRA_DESTINO" id="cobro-destino" />
                  <Label htmlFor="cobro-destino">Cobrar en destino</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* TOTAL Y BOTON */}
          <Card className="bg-[#FFF5F5] border-[#C8102E]/20">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-[#8A8A8A]">Costo de envío</p>
                <p className="text-3xl font-bold text-[#C8102E]">¢{selectedSize?.price.toLocaleString()}</p>
              </div>
              <Button
                type="submit"
                className="h-14 px-8 bg-[#C8102E] hover:bg-[#9B0B22] text-lg"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creando..." : "Crear Envío Nacional"}
              </Button>
            </CardContent>
          </Card>
        </form>

        {/* DIALOG EXITO */}
        <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-center">¡Envío Nacional Creado!</DialogTitle>
            </DialogHeader>
            <div className="text-center space-y-4 py-4">
              <p className="text-[#8A8A8A]">Guía de rastreo:</p>
              <p className="text-3xl font-bold font-mono text-[#C8102E]">{createdTrackingNumber}</p>
              <Button variant="outline" onClick={copyTracking} className="gap-2">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copiado" : "Copiar guía"}
              </Button>
              <div className="flex gap-3 pt-2">
                <Button onClick={() => { setSuccessDialog(false); navigate("/envios-nacionales"); }} className="flex-1 bg-[#C8102E] hover:bg-[#9B0B22]">
                  Ver mis envíos
                </Button>
                <Button onClick={() => { setSuccessDialog(false); }} variant="outline" className="flex-1">
                  Crear otro
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </FranchiseLayout>
  );
}