import { useState, useCallback, useMemo } from "react";
import {
  getShipments,
  getShipmentById,
  getShipmentByTracking,
  addShipment,
  updateShipmentStatus,
  cancelShipment,
  generateTrackingNumber,
  getFranchiseName,
  loadData,
  saveData,
  type DemoShipment,
  FRANCHISES,
} from "./data";
import { useDemoAuth } from "./useDemoAuth";

// ===== STATS =====
export function useDemoStats() {
  const { user } = useDemoAuth();
  return useMemo(() => {
    if (!user) return null;
    const all = getShipments();
    const franchiseId = user.franchiseId;
    const isWarehouse = user.franchise?.isWarehouse === 1;

    const relevant = isWarehouse
      ? all
      : all.filter(
          (s) =>
            s.originFranchiseId === franchiseId ||
            s.destinationFranchiseId === franchiseId
        );

    return {
      total: relevant.length,
      pending: relevant.filter((s) => s.status === "ENVIADO_A_BODEGA").length,
      inTransit: relevant.filter((s) => s.status === "ENVIADO_A_DESTINO").length,
      inWarehouse: relevant.filter((s) => s.status === "RECIBIDO_EN_BODEGA").length,
      delivered: relevant.filter((s) => s.status === "RECIBIDO_EN_DESTINO").length,
      cancelled: relevant.filter((s) => s.status === "CANCELADO").length,
    };
  }, [user]);
}

// ===== LIST =====
export function useDemoList() {
  const { user } = useDemoAuth();
  return useMemo(() => {
    if (!user) return [];
    const all = getShipments();
    const franchiseId = user.franchiseId;
    const isWarehouse = user.franchise?.isWarehouse === 1;

    return isWarehouse
      ? all
      : all.filter(
          (s) =>
            s.originFranchiseId === franchiseId ||
            s.destinationFranchiseId === franchiseId
        );
  }, [user]);
}

// ===== GET BY ID =====
export function useDemoShipment(id: number) {
  return useMemo(() => {
    const s = getShipmentById(id);
    if (!s) return null;
    return enrichShipment(s);
  }, [id]);
}

// ===== TRACK =====
export function useDemoTrack(trackingNumber: string) {
  return useMemo(() => {
    if (!trackingNumber) return null;
    const s = getShipmentByTracking(trackingNumber);
    if (!s) return null;
    return enrichShipment(s);
  }, [trackingNumber]);
}

// ===== CREATE =====
export function useDemoCreate() {
  const { user } = useDemoAuth();
  const [isPending, setIsPending] = useState(false);

  const create = useCallback(
    (input: {
      senderName: string;
      senderPhone: string;
      destinationFranchiseId: number;
      invoiceNumber?: string;
      notes?: string;
      items: { description: string; quantity: number; details?: string }[];
    }) => {
      setIsPending(true);
      const tracking = generateTrackingNumber();
      const now = new Date().toISOString();
      const originId = user?.franchiseId || 1;
      const actorName = user?.displayName || "Usuario";

      const newShipment = addShipment({
        trackingNumber: tracking,
        invoiceNumber: input.invoiceNumber || null,
        senderName: input.senderName,
        senderPhone: input.senderPhone,
        receiverName: null,
        originFranchiseId: originId,
        destinationFranchiseId: input.destinationFranchiseId,
        currentLocationId: originId,
        status: "CREADO",
        notes: input.notes || null,
        createdBy: user?.id || 1,
        createdAt: now,
        updatedAt: now,
        items: input.items.map((item, idx) => ({
          id: idx + 1,
          description: item.description,
          quantity: item.quantity,
          details: item.details || null,
        })),
        tracking: [
          {
            id: Date.now(),
            status: "CREADO",
            notes: "Envio creado",
            createdAt: now,
            actorName,
          },
        ],
      });

      setIsPending(false);
      return { success: true, shipmentId: newShipment.id, trackingNumber: tracking };
    },
    [user]
  );

  return { create, isPending };
}

// ===== UPDATE STATUS =====
export function useDemoUpdateStatus() {
  const { user } = useDemoAuth();

  const update = useCallback(
    (shipmentId: number, status: string, notes?: string) => {
      const actorName = user?.displayName || "Usuario";
      const result = updateShipmentStatus(shipmentId, status, notes || null, actorName);
      return result ? { success: true } : null;
    },
    [user]
  );

  return { update };
}

// ===== CANCEL =====
export function useDemoCancel() {
  const { user } = useDemoAuth();

  const cancel = useCallback(
    (shipmentId: number, reason: string) => {
      const actorName = user?.displayName || "Usuario";
      return cancelShipment(shipmentId, reason, actorName);
    },
    [user]
  );

  return { cancel };
}

// ===== PENDING COUNT =====
export function useDemoPendingCount() {
  const { user } = useDemoAuth();
  return useMemo(() => {
    if (!user) return 0;
    const all = getShipments();
    const isWarehouse = user.franchise?.isWarehouse === 1;
    if (isWarehouse) {
      return all.filter((s) => s.status === "ENVIADO_A_BODEGA").length;
    }
    return all.filter(
      (s) =>
        s.originFranchiseId === user.franchiseId &&
        s.status === "ENVIADO_A_BODEGA"
    ).length;
  }, [user]);
}

// ===== BOLETA =====
export function useDemoBoleta(id: number) {
  return useDemoShipment(id);
}

// ===== BITACORA =====
export function useDemoBitacora(ids: number[]) {
  return useMemo(() => {
    const all = getShipments();
    const selected = all.filter((s) => ids.includes(s.id));
    const enriched = selected.map(enrichShipment);
    return {
      shipments: enriched,
      totalPackages: enriched.reduce(
        (sum, s) => sum + (s.items?.reduce((a: number, i: any) => a + i.quantity, 0) || 0),
        0
      ),
      generatedAt: new Date().toISOString(),
    };
  }, [ids.join(",")]);
}

// ===== HELPERS =====
function enrichShipment(s: DemoShipment) {
  const originFranchise = FRANCHISES.find((f) => f.id === s.originFranchiseId);
  const destinationFranchise = FRANCHISES.find((f) => f.id === s.destinationFranchiseId);
  const currentLocation = FRANCHISES.find((f) => f.id === s.currentLocationId);

  return {
    ...s,
    originFranchise: originFranchise || null,
    destinationFranchise: destinationFranchise || null,
    currentLocation: currentLocation || null,
    originName: originFranchise?.displayName || "Desconocido",
    destinationName: destinationFranchise?.displayName || "Desconocido",
    currentLocationName: currentLocation?.displayName || "Desconocido",
  };
}
