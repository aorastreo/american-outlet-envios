import { useState } from "react";
import { Link } from "react-router";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Search, Trash2, Truck } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function NationalShipments() {
  const { user } = useFranchiseAuth();
  const isWarehouse = user?.franchise?.isWarehouse === 1;
  const { data: shipments, isLoading } = trpc.nationalShipping.list.useQuery();
  const utils = trpc.useUtils();

  const [searchQuery, setSearchQuery] = useState("");

  const deleteMutation = trpc.nationalShipping.delete.useMutation({
    onSuccess: () => {
      utils.nationalShipping.list.invalidate();
    },
  });

  const filteredShipments = (shipments || []).filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.trackingNumber.toLowerCase().includes(q) ||
      s.receiverName.toLowerCase().includes(q) ||
      s.province.toLowerCase().includes(q)
    );
  });

  return (
    <FranchiseLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A] flex items-center gap-2">
              <Truck className="w-7 h-7 text-[#C8102E]" />
              Envios Nacionales
            </h1>
            <p className="text-[#8A8A8A] mt-1">Registro de envios a todo el pais</p>
          </div>
          <Link to="/envio-nacional">
            <Button className="bg-[#C8102E] hover:bg-[#9B0B22]">
              <Package className="w-4 h-4 mr-2" />
              Nuevo Envio
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" />
              <Input
                placeholder="Buscar por guia, destinatario o provincia..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8102E]" />
          </div>
        ) : filteredShipments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-[#8A8A8A]">
              <Package className="w-12 h-12 mx-auto mb-3 text-[#D4D4D4]" />
              <p className="font-medium">No hay envios nacionales</p>
              <p className="text-sm mt-1">Cree su primer envio nacional</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredShipments.map((s) => (
              <Card key={s.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="inline-block bg-[#1A1A1A] text-white text-xs font-mono font-bold px-2 py-0.5 rounded">
                          {s.trackingNumber}
                        </span>
                        <Badge variant="secondary" className={
                          s.packageSize === "PEQUENO" ? "bg-emerald-50 text-emerald-700" :
                          s.packageSize === "MEDIANO" ? "bg-blue-50 text-blue-700" :
                          "bg-purple-50 text-purple-700"
                        }>
                          {s.packageSize === "PEQUENO" ? "Pequeno" : s.packageSize === "MEDIANO" ? "Mediano" : "Grande"} - ¢{s.shippingCost?.toLocaleString()}
                        </Badge>
                        <Badge variant="secondary" className={
                          s.paymentMethod === "PAGA_ORIGEN" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }>
                          {s.paymentMethod === "PAGA_ORIGEN" ? "Pagado" : "Cobrar destino"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-[#525252] flex-wrap">
                        <span className="font-medium">{s.receiverName}</span>
                        <span className="text-[#8A8A8A]">| {s.receiverPhone}</span>
                        <span className="text-[#8A8A8A]">| {s.province}, {s.canton}, {s.district}</span>
                      </div>
                      <p className="text-sm text-[#8A8A8A] mt-1">{s.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-[#A3A3A3]">
                        {s.createdAt ? format(new