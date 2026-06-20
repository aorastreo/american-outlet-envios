import { useState } from "react";
import { Link } from "react-router";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Trash2,
  Package,
  MapPin,
  Phone,
  User,
  CreditCard,
  FileText,
  Truck,
} from "lucide-react";

const COST_MAP: Record<string, number> = {
  PEQUENO: 1000,
  MEDIANO: 3500,
  GRANDE: 6500,
};

const SIZE_LABELS: Record<string, { label: string; color: string }> = {
  PEQUENO: { label: "Pequeno", color: "text-green-600 bg-green-50" },
  MEDIANO: { label: "Mediano", color: "text-yellow-600 bg-yellow-50" },
  GRANDE: { label: "Grande", color: "text-red-600 bg-red-50" },
};

const PAYMENT_LABELS: Record<string, { label: string; color: string }> = {
  PAGA_ORIGEN: { label: "Pagado", color: "text-green-600 bg-green-50" },
};

export default function NationalShipments() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const utils = trpc.useUtils();
  const { data: shipments, isLoading } = trpc.nationalShipping.list.useQuery();

  const deleteMutation = trpc.nationalShipping.delete.useMutation({
    onSuccess: () => {
      utils.nationalShipping.list.invalidate();
      setDeleteId(null);
    },
  });

  const filteredShipments = shipments?.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.receiverName.toLowerCase().includes(q) ||
      s.receiverPhone.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.province.toLowerCase().includes(q) ||
      s.canton.toLowerCase().includes(q) ||
      s.district.toLowerCase().includes(q)
    );
  });

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (!filteredShipments) return;
    if (selectedIds.length === filteredShipments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredShipments.map((s) => s.id));
    }
  };

  const openBoleta = (id: number) => {
    window.open(`/boleta-nacional/${id}`, "_blank");
  };

  const openBitacora = () => {
    if (selectedIds.length === 0) return;
    const idsParam = selectedIds.join(",");
    window.open(`/bitacora-nacional?ids=${idsParam}`, "_blank");
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("es-CR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <FranchiseLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-600" />
            Envios Nacionales
          </h1>
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <Button
                onClick={openBitacora}
                className="bg-[#C8102E] hover:bg-[#9B0B22]"
              >
                <Truck className="h-4 w-4 mr-2" />
                Bitacora ({selectedIds.length})
              </Button>
            )}
            <Link to="/envios-nacionales/nuevo">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Envio
              </Button>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, telefono, contenido o ubicacion..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {filteredShipments?.length ?? 0} envio{filteredShipments?.length !== 1 ? "s" : ""} registrado{filteredShipments?.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Cargando envios...</div>
            ) : filteredShipments && filteredShipments.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedIds.length === filteredShipments.length && filteredShipments.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Destinatario</TableHead>
                      <TableHead>Telefono</TableHead>
                      <TableHead>Ubicacion</TableHead>
                      <TableHead>Contenido</TableHead>
                      <TableHead>Tarifa</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredShipments.map((s) => {
                      const pkg = SIZE_LABELS[s.packageSize];
                      const pay = PAYMENT_LABELS[s.paymentMethod];
                      const cost = COST_MAP[s.packageSize];
                      return (
                        <TableRow key={s.id} className="hover:bg-gray-50">
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(s.id)}
                              onCheckedChange={() => toggleSelection(s.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="font-medium">{s.receiverName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-gray-400" />
                              {s.receiverPhone}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                              <span className="text-sm">
                                {s.province}, {s.canton}, {s.district}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={s.description}>
                            {s.description}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${pkg?.color ?? ""}`}>
                              {pkg?.label ?? s.packageSize} - &cent;{cost?.toLocaleString() ?? ""}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${pay?.color ?? ""}`}>
                              <CreditCard className="h-3 w-3 mr-1" />
                              {pay?.label ?? s.paymentMethod}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                            {formatDate(s.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openBoleta(s.id)}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                title="Boleta"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteId(s.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-1">
                  {search.trim() ? "No se encontraron envios con ese criterio" : "No hay envios nacionales registrados"}
                </p>
                {!search.trim() && (
                  <Link to="/envios-nacionales/nuevo">
                    <Button variant="outline" className="mt-3">
                      <Plus className="h-4 w-4 mr-2" />
                      Crear primer envio
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminacion</DialogTitle>
            <DialogDescription>
              Esta seguro que desea eliminar este envio nacional? Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FranchiseLayout>
  );
}
