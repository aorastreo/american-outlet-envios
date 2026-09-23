import { z } from "zod";
import { eq, or, and, desc, sql, inArray } from "drizzle-orm";
import { createRouter, publicQuery, franchiseAuthedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  shipments,
  shipmentItems,
  shipmentTracking,
  franchises,
  franchiseUsers,
} from "@db/schema";
import { TRPCError } from "@trpc/server";

// Helper: limpiar nombres de franquicia
function cleanFranchiseName(name: string | null | undefined): string {
  if (!name) return "Tienda";
  const upper = name.toUpperCase();
  if (upper.includes("GANGA")) return "Ganga Santa Rosa";
  return name.replace(/AMERICAN OUTLET\s*/i, "").trim() || name;
}

const statusEnum = z.enum([
  "CREADO",
  "ENVIADO_A_BODEGA",
  "RECIBIDO_EN_BODEGA",
  "ENVIADO_A_DESTINO",
  "RECIBIDO_EN_DESTINO",
  "EN_RUTA",
  "EN_PARADA",
  "CANCELADO",
]);

// ─── TRACKING NUMBER GENERATION ──────────────────────────────────
function randomDigit(): string {
  return String(Math.floor(Math.random() * 10));
}


// ─── Helper: determine target warehouse based on origin/destination ───
// Returns which warehouse handles this shipment
// - "Bodega Pavon" for shipments from/to: Los Chiles, Pavon, Santa Rosa, Ganga
// - "Bodega Cedi" for shipments from/to: Boca Arenal, Florencia, Fortuna, Ciudad Quesada, Puerto Viejo
// - Cross-group: starts at origin's warehouse, then transfers to destination's warehouse
function getTargetBodega(originName?: string | null, destName?: string | null): { firstBodega: string; finalBodega: string; needsInterBodega: boolean } {
  const MY_STORES = ["los chiles", "pavon", "santa rosa", "ganga"];
  const VENDOR_STORES = ["boca arenal", "florencia", "fortuna", "ciudad quesada", "puerto viejo"];

  const originLower = (originName || "").toLowerCase();
  const destLower = (destName || "").toLowerCase();

  const originIsMine = MY_STORES.some(s => originLower.includes(s));
  const originIsVendor = VENDOR_STORES.some(s => originLower.includes(s));
  const destIsMine = MY_STORES.some(s => destLower.includes(s));
  const destIsVendor = VENDOR_STORES.some(s => destLower.includes(s));

  // Same group: single bodega
  if (originIsMine && destIsMine) {
    return { firstBodega: "Bodega Pavon", finalBodega: "Bodega Pavon", needsInterBodega: false };
  }
  if (originIsVendor && destIsVendor) {
    return { firstBodega: "Bodega Cedi", finalBodega: "Bodega Cedi", needsInterBodega: false };
  }

  // Cross-group: inter-bodega transfer needed
  if (originIsMine && destIsVendor) {
    return { firstBodega: "Bodega Pavon", finalBodega: "Bodega Cedi", needsInterBodega: true };
  }
  if (originIsVendor && destIsMine) {
    return { firstBodega: "Bodega Cedi", finalBodega: "Bodega Pavon", needsInterBodega: true };
  }

  // Fallback: try to infer from names
  if (originLower.includes("bodega") || destLower.includes("bodega")) {
    return { firstBodega: "Bodega Pavon", finalBodega: "Bodega Pavon", needsInterBodega: false };
  }

  return { firstBodega: "Bodega Pavon", finalBodega: "Bodega Pavon", needsInterBodega: false };
}

function randomLetter(): string {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ"; // excluye I, L, O para evitar confusiones
  return letters.charAt(Math.floor(Math.random() * letters.length));
}

async function generateTrackingNumber(): Promise<string> {
  const db = getDb();

  // Generar numeros de guia impredecibles: AO + 8 digitos aleatorios + 1 letra
  // Ejemplo: AO84729153X, AO10293847K
  // Sin guiones, sin secuencia predecible
  for (let attempt = 0; attempt < 10; attempt++) {
    let numberPart = "";
    for (let i = 0; i < 8; i++) {
      numberPart += randomDigit();
    }
    const letter = randomLetter();
    const trackingNumber = `AO${numberPart}${letter}`;

    // Verificar que no exista ya en la base de datos
    const existing = await db
      .select({ trackingNumber: shipments.trackingNumber })
      .from(shipments)
      .where(eq(shipments.trackingNumber, trackingNumber))
      .limit(1);

    if (existing.length === 0) {
      return trackingNumber; // Unico, lo retornamos
    }
    // Si existe, intentamos otra vez con otros numeros
  }

  // En el caso extremo de 10 colisiones, agregar timestamp para garantizar unicidad
  const fallbackNumber = `AO${Date.now().toString().slice(-8)}${randomLetter()}`;
  return fallbackNumber;
}

export const shipmentRouter = createRouter({
  // ─── Create Shipment ───────────────────────────────────────────
  create: franchiseAuthedQuery
    .input(
      z.object({
        invoiceNumber: z.string().max(50).optional(),
        senderName: z.string().min(1).max(255),
        senderPhone: z.string().min(1).max(50),
        destinationFranchiseId: z.number().min(1),
        notes: z.string().optional(),
        items: z.array(
          z.object({
            description: z.string().min(1).max(255),
            quantity: z.number().min(1).default(1),
            details: z.string().max(500).optional(),
          })
        ).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const originId = ctx.franchiseUser!.franchiseId;

      if (originId === input.destinationFranchiseId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La tienda de origen y destino no pueden ser la misma" });
      }

      // Get both warehouses
      const allWarehouses = await db.select().from(franchises).where(eq(franchises.isWarehouse, 1));
      const bodegaPavon = allWarehouses.find(w => w.code === "bodega");
      const bodegaCedi = allWarehouses.find(w => w.code === "bodega_cedi");

      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, originId)).limit(1);
      const originIsWarehouse = userFranchise[0]?.isWarehouse === 1;

      if (originIsWarehouse && input.destinationFranchiseId === originId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La bodega no puede enviar envios a si misma" });
      }

      // Get destination franchise name for bodega assignment
      const destFranchise = await db.select().from(franchises).where(eq(franchises.id, input.destinationFranchiseId)).limit(1);
      const destName = destFranchise[0]?.name || "";
      const originName = userFranchise[0]?.name || "";

      // Determine target bodega
      const { firstBodega } = getTargetBodega(originName, destName);

      // Check if this is a pickup route (destination is Grecia, SanRamon, Palmares)
      const pickupCodes = ["grecia", "san_ramon", "palmares"];
      const isPickup = pickupCodes.includes(destFranchise[0]?.code?.toLowerCase() || "");
      const initialStatus = originIsWarehouse && isPickup ? "RECIBIDO_EN_BODEGA" : "CREADO";
      const trackingNotes = originIsWarehouse && isPickup ? "Envio creado en bodega - listo para ruta de camion" : "Envio creado";

      const trackingNumber = await generateTrackingNumber();

      const shipmentResult = await db.insert(shipments).values({
        trackingNumber,
        invoiceNumber: input.invoiceNumber?.trim() || null,
        senderName: input.senderName.trim(),
        senderPhone: input.senderPhone.trim(),
        originFranchiseId: originId,
        destinationFranchiseId: input.destinationFranchiseId,
        currentLocationId: originId,
        status: initialStatus,
        warehouseLocation: firstBodega,
        notes: input.notes?.trim() || null,
        createdBy: ctx.franchiseUser!.id,
      });

      const shipmentId = Number(shipmentResult[0].insertId);
      for (const item of input.items) {
        await db.insert(shipmentItems).values({ shipmentId, description: item.description, quantity: item.quantity, ...(item.details ? { details: item.details } : {}) });
      }
      await db.insert(shipmentTracking).values({ shipmentId, status: initialStatus, locationId: originId, notes: trackingNotes, createdBy: ctx.franchiseUser!.id });

      return { success: true, shipmentId, trackingNumber };
    }),

  // ─── List Shipments (with pagination) ──────────────────────────
  list: franchiseAuthedQuery
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const page = input?.page || 1;
      const pageSize = input?.limit || 50;
      const offset = (page - 1) * pageSize;

      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      const isWarehouse = userFranchise[0]?.isWarehouse === 1;

      let whereClause;

      if (isWarehouse) {
        // WAREHOUSE USER: only see shipments assigned to this warehouse
        const myBodegaName = userFranchise[0]?.name || "";
        const normalizedName = myBodegaName.toLowerCase().includes("cedi") ? "Bodega Cedi" : "Bodega Pavon";

        whereClause = or(
          eq(shipments.warehouseLocation, normalizedName),
          sql`${shipments.warehouseLocation} IS NULL`, // legacy shipments
        );
      } else {
        // STORE USER: see shipments related to this store
        whereClause = or(
          eq(shipments.originFranchiseId, franchiseId),
          eq(shipments.destinationFranchiseId, franchiseId),
          eq(shipments.currentLocationId, franchiseId),
          sql`${shipments.status} = 'ENVIADO_A_DESTINO' AND ${shipments.destinationFranchiseId} = ${franchiseId}`,
        );
      }

      const result = await db
        .select({
          id: shipments.id,
          trackingNumber: shipments.trackingNumber,
          invoiceNumber: shipments.invoiceNumber,
          senderName: shipments.senderName,
          senderPhone: shipments.senderPhone,
          status: shipments.status,
          notes: shipments.notes,
          createdAt: shipments.createdAt,
          updatedAt: shipments.updatedAt,
          originFranchiseId: shipments.originFranchiseId,
          destinationFranchiseId: shipments.destinationFranchiseId,
          currentLocationId: shipments.currentLocationId,
          warehouseLocation: shipments.warehouseLocation,
          createdBy: shipments.createdBy,
                   originName: franchises.name,
          destinationName: sql<string>`(SELECT f2.name FROM franchises f2 WHERE f2.id = ${shipments.destinationFranchiseId})`,
          currentLocationName: sql<string>`(SELECT f3.name FROM franchises f3 WHERE f3.id = ${shipments.currentLocationId})`,
        })
        .from(shipments)
        .leftJoin(franchises, eq(franchises.id, shipments.originFranchiseId))
        .where(whereClause)
        .orderBy(desc(shipments.createdAt))
        .limit(pageSize)
        .offset(offset);

      // Limpia nombres de franquicia
      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map(f => [f.id, { ...f, displayName: cleanFranchiseName(f.displayName) }]));

      return result.map(s => ({
        ...s,
        originName: cleanFranchiseName(franchiseMap.get(s.originFranchiseId)?.displayName || s.originName),
        destinationName: cleanFranchiseName(franchiseMap.get(s.destinationFranchiseId)?.displayName || s.destinationName),
        currentLocationName: cleanFranchiseName(franchiseMap.get(s.currentLocationId)?.displayName || s.currentLocationName),
      }));
    }),

  // ─── Get Shipment by ID (with actor names in tracking) ─────────
  getById: franchiseAuthedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      const isWarehouse = userFranchise[0]?.isWarehouse === 1;

      const shipment = await db.select().from(shipments).where(eq(shipments.id, input.id)).limit(1);
      if (shipment.length === 0) return null;

      // TODAS las franquicias pueden ver cualquier envio - verificacion de permisos removida

      const items = await db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, input.id));

      const trackingHistory = await db
        .select()
        .from(shipmentTracking)
        .where(eq(shipmentTracking.shipmentId, input.id))
        .orderBy(shipmentTracking.createdAt);

      // Get franchise names
      const allFranchises = await db.select().from(franchises);
            const franchiseMap = new Map(allFranchises.map(f => [f.id, { ...f, displayName: cleanFranchiseName(f.displayName) }]));

      // Get all actor names (franchise users)
      const actorIds = [...new Set(trackingHistory.map(t => t.createdBy))].filter(Boolean);
      const actors = actorIds.length > 0
        ? await db.select().from(franchiseUsers).where(inArray(franchiseUsers.id, actorIds))
        : [];
      const actorMap = new Map(actors.map(a => [a.id, a.displayName]));

      const trackingWithActors = trackingHistory.map(t => ({
        ...t,
        actorName: actorMap.get(t.createdBy) || "Sistema",
      }));

      const destFranchise = franchiseMap.get(shipment[0].destinationFranchiseId);
      const pickupCodes = ["grecia", "san_ramon", "palmares"];
      const isPickupRoute = pickupCodes.includes(destFranchise?.code?.toLowerCase() || "") ||
                            (destFranchise?.displayName?.toLowerCase() || "").includes("recogida");

      return {
        ...shipment[0],
        items,
        tracking: trackingWithActors,
        originFranchise: franchiseMap.get(shipment[0].originFranchiseId),
        destinationFranchise: destFranchise,
        destinationFranchiseId: shipment[0].destinationFranchiseId,
        currentLocation: franchiseMap.get(shipment[0].currentLocationId),
        isPickupRoute,
      };
    }),

  // ─── Update Status (with receiverName support) ─────────────────
  updateStatus: franchiseAuthedQuery
    .input(
      z.object({
        id: z.number(),
        newStatus: statusEnum,
        notes: z.string().optional(),
        receiverName: z.string().optional(),
        warehouseLocation: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      const isWarehouse = userFranchise[0]?.isWarehouse === 1;

      const current = await db.select().from(shipments).where(eq(shipments.id, input.id)).limit(1);
      if (current.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Envio no encontrado" });

      const shipment = current[0];
      // Get both warehouses
      const allWarehouses = await db.select().from(franchises).where(eq(franchises.isWarehouse, 1));
      const bodegaPavon = allWarehouses.find(w => w.code === "bodega");
      const bodegaCedi = allWarehouses.find(w => w.code === "bodega_cedi");
      const warehouseIds = allWarehouses.map(w => w.id);
      const originIsWarehouse = warehouseIds.includes(shipment.originFranchiseId);

      // Determine target bodega for this shipment
      let targetBodegaId: number | null = null;
      if (shipment.warehouseLocation === "Bodega Cedi" && bodegaCedi) {
        targetBodegaId = bodegaCedi.id;
      } else if (bodegaPavon) {
        targetBodegaId = bodegaPavon.id;
      }

      // Validate transitions
      const validTransitions: Record<string, string[]> = originIsWarehouse
        ? { CREADO: ["ENVIADO_A_DESTINO", "CANCELADO"], ENVIADO_A_DESTINO: ["RECIBIDO_EN_DESTINO"], RECIBIDO_EN_DESTINO: [], CANCELADO: [], ENVIADO_A_BODEGA: [], RECIBIDO_EN_BODEGA: [] }
        : { CREADO: ["ENVIADO_A_BODEGA", "CANCELADO"], ENVIADO_A_BODEGA: ["RECIBIDO_EN_BODEGA"], RECIBIDO_EN_BODEGA: ["ENVIADO_A_DESTINO"], ENVIADO_A_DESTINO: ["RECIBIDO_EN_DESTINO"], RECIBIDO_EN_DESTINO: [], CANCELADO: [] };

      const allowed = validTransitions[shipment.status] || [];
      if (!allowed.includes(input.newStatus)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `No se puede cambiar de ${shipment.status} a ${input.newStatus}` });
      }

      // Validate permissions
      if (input.newStatus === "ENVIADO_A_BODEGA" && shipment.originFranchiseId !== franchiseId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo la tienda de origen puede marcar como enviado a bodega" });
      } else if (input.newStatus === "RECIBIDO_EN_BODEGA" && !isWarehouse) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo la bodega puede marcar como recibido" });
      } else if (input.newStatus === "ENVIADO_A_DESTINO") {
        const canConfirm = originIsWarehouse ? (shipment.originFranchiseId === franchiseId) : isWarehouse;
        if (!canConfirm) throw new TRPCError({ code: "FORBIDDEN", message: "Solo la bodega puede marcar como enviado a destino" });
      } else if (input.newStatus === "RECIBIDO_EN_DESTINO" && shipment.destinationFranchiseId !== franchiseId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo la tienda de destino puede marcar como recibido" });
      }

      let newLocationId = shipment.currentLocationId;
      if (input.newStatus === "ENVIADO_A_BODEGA") newLocationId = targetBodegaId || shipment.currentLocationId;
      else if (input.newStatus === "RECIBIDO_EN_BODEGA") newLocationId = targetBodegaId || shipment.currentLocationId;
      else if (input.newStatus === "ENVIADO_A_DESTINO") newLocationId = shipment.destinationFranchiseId;
      else if (input.newStatus === "RECIBIDO_EN_DESTINO") newLocationId = shipment.destinationFranchiseId;

      // Build update data
      const updateData: Record<string, any> = {
        status: input.newStatus,
        currentLocationId: newLocationId,
      };
      if (input.newStatus === "RECIBIDO_EN_BODEGA" && input.warehouseLocation) {
        updateData.warehouseLocation = input.warehouseLocation;
      }
      if (input.newStatus === "ENVIADO_A_DESTINO" && input.warehouseLocation) {
        updateData.warehouseLocation = input.warehouseLocation;
      }
      if (input.newStatus === "RECIBIDO_EN_DESTINO" && input.receiverName?.trim()) {
        updateData.receiverName = input.receiverName.trim();
      }

      await db.update(shipments).set(updateData).where(eq(shipments.id, input.id));

      // Build contextual notes with warehouse location when applicable
      const bodegaLabel = input.warehouseLocation || "";
      const statusNotes: Record<string, string> = {
        ENVIADO_A_BODEGA: bodegaLabel
          ? `Enviado a ${bodegaLabel} por tienda de origen`
          : "Enviado a bodega por tienda de origen",
        RECIBIDO_EN_BODEGA: bodegaLabel
          ? `Recibido en ${bodegaLabel}`
          : "Recibido en bodega",
        ENVIADO_A_DESTINO: bodegaLabel
          ? `Enviado a destino desde ${bodegaLabel}`
          : originIsWarehouse
            ? "Enviado directamente desde bodega a tienda de destino"
            : "Enviado a tienda de destino desde bodega",
        RECIBIDO_EN_DESTINO: input.receiverName?.trim()
          ? `Recibido por: ${input.receiverName.trim()}`
          : "Recibido en tienda de destino",
      };

      await db.insert(shipmentTracking).values({
        shipmentId: input.id,
        status: input.newStatus,
        locationId: newLocationId,
        notes: input.notes || statusNotes[input.newStatus] || `Estado cambiado a ${input.newStatus}`,
        createdBy: ctx.franchiseUser!.id,
      });

      return { success: true };
    }),

  // ─── Cancel Shipment ───────────────────────────────────────────
  cancel: franchiseAuthedQuery
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;

      const current = await db.select().from(shipments).where(eq(shipments.id, input.id)).limit(1);
      if (current.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Envio no encontrado" });

      const shipment = current[0];

      // Only origin or destination can cancel, and only if not already delivered or cancelled
      if (shipment.status === "RECIBIDO_EN_DESTINO" || shipment.status === "CANCELADO") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No se puede cancelar un envio que ya fue entregado o cancelado" });
      }

      const isInvolved = shipment.originFranchiseId === franchiseId ||
                         shipment.destinationFranchiseId === franchiseId ||
                         shipment.currentLocationId === franchiseId;
      if (!isInvolved) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo las franquicias involucradas pueden cancelar el envio" });
      }

      await db.update(shipments)
        .set({ status: "CANCELADO", currentLocationId: shipment.originFranchiseId })
        .where(eq(shipments.id, input.id));

      await db.insert(shipmentTracking).values({
        shipmentId: input.id,
        status: "CANCELADO",
        locationId: shipment.originFranchiseId,
        notes: input.reason?.trim() ? `Cancelado: ${input.reason.trim()}` : "Envio cancelado",
        createdBy: ctx.franchiseUser!.id,
      });

      return { success: true };
    }),

  // ─── Public Track ──────────────────────────────────────────────
  track: publicQuery
    .input(z.object({ trackingNumber: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const shipment = await db.select().from(shipments).where(eq(shipments.trackingNumber, input.trackingNumber)).limit(1);
      if (shipment.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Numero de rastreo no encontrado" });

      const items = await db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, shipment[0].id));
      const trackingHistory = await db.select().from(shipmentTracking).where(eq(shipmentTracking.shipmentId, shipment[0].id)).orderBy(shipmentTracking.createdAt);

      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map(f => [f.id, { ...f, displayName: cleanFranchiseName(f.displayName) }]));

      const destFranchise = franchiseMap.get(shipment[0].destinationFranchiseId);
      const pickupCodes = ["grecia", "san_ramon", "palmares"];
      const isPickupRoute = pickupCodes.includes(destFranchise?.code?.toLowerCase() || "") ||
                            (destFranchise?.displayName?.toLowerCase() || "").includes("recogida");

      const destFranchiseData = franchiseMap.get(shipment[0].destinationFranchiseId);
      console.log("[track] destFranchise:", destFranchiseData?.displayName, "isWarehouse:", destFranchiseData?.isWarehouse, "destId:", shipment[0].destinationFranchiseId);

      return {
        ...shipment[0],
        items,
        tracking: trackingHistory,
        originFranchise: franchiseMap.get(shipment[0].originFranchiseId),
        destinationFranchise: destFranchiseData,
        destinationFranchiseId: shipment[0].destinationFranchiseId,
        destinationIsWarehouse: destFranchiseData?.isWarehouse === 1,
        currentLocation: franchiseMap.get(shipment[0].currentLocationId),
        isPickupRoute,
      };
    }),

  // ─── Stats ─────────────────────────────────────────────────────
  stats: franchiseAuthedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const franchiseId = ctx.franchiseUser!.franchiseId;
    const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
    const isWarehouse = userFranchise[0]?.isWarehouse === 1;

    let whereClause;
    if (isWarehouse) {
      const myBodegaName = userFranchise[0]?.name || "";
      const normalizedName = myBodegaName.toLowerCase().includes("cedi") ? "Bodega Cedi" : "Bodega Pavon";
      whereClause = or(
        eq(shipments.warehouseLocation, normalizedName),
        sql`${shipments.warehouseLocation} IS NULL`,
      );
    } else {
      whereClause = or(
        eq(shipments.originFranchiseId, franchiseId),
        eq(shipments.destinationFranchiseId, franchiseId),
        eq(shipments.currentLocationId, franchiseId),
        sql`${shipments.status} = 'ENVIADO_A_DESTINO' AND ${shipments.destinationFranchiseId} = ${franchiseId}`,
      );
    }

    const allShipments = await db.select().from(shipments).where(whereClause);
    const pending = allShipments.filter((s) => s.status !== "RECIBIDO_EN_DESTINO" && s.status !== "CANCELADO");

    return {
      total: allShipments.length,
      pending: pending.length,
      delivered: allShipments.filter((s) => s.status === "RECIBIDO_EN_DESTINO").length,
      inTransit: allShipments.filter((s) => s.status === "ENVIADO_A_BODEGA" || s.status === "ENVIADO_A_DESTINO").length,
      inWarehouse: allShipments.filter((s) => s.status === "RECIBIDO_EN_BODEGA").length,
      cancelled: allShipments.filter((s) => s.status === "CANCELADO").length,
    };
  }),

  // ─── Pending count (for sidebar badge) ─────────────────────────
  pendingCount: franchiseAuthedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const franchiseId = ctx.franchiseUser!.franchiseId;
    const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
    const isWarehouse = userFranchise[0]?.isWarehouse === 1;

    if (isWarehouse) {
      // Warehouse: count ENVIADO_A_BODEGA assigned to this warehouse
      const myBodegaName = userFranchise[0]?.name || "";
      const normalizedName = myBodegaName.toLowerCase().includes("cedi") ? "Bodega Cedi" : "Bodega Pavon";
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(shipments)
        .where(and(
          eq(shipments.status, "ENVIADO_A_BODEGA"),
          or(eq(shipments.warehouseLocation, normalizedName), sql`${shipments.warehouseLocation} IS NULL`)
        ));
      return countResult[0]?.count || 0;
    } else {
      // Store: count CREADO from this store + ENVIADO_A_DESTINO to this store
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(shipments)
        .where(or(
          sql`${shipments.status} = 'CREADO' AND ${shipments.originFranchiseId} = ${franchiseId}`,
          sql`${shipments.status} = 'ENVIADO_A_DESTINO' AND ${shipments.destinationFranchiseId} = ${franchiseId}`,
        ));
      return countResult[0]?.count || 0;
    }
  }),

  // ─── Get Boleta (printable receipt for package) ────────────────
  getBoleta: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const shipment = await db
        .select()
        .from(shipments)
        .where(eq(shipments.id, input.id))
        .limit(1);
      if (shipment.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Envio no encontrado" });

      const items = await db
        .select()
        .from(shipmentItems)
        .where(eq(shipmentItems.shipmentId, input.id));

      const trackingHistory = await db
        .select()
        .from(shipmentTracking)
        .where(eq(shipmentTracking.shipmentId, input.id))
        .orderBy(shipmentTracking.createdAt);

      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map(f => [f.id, { ...f, displayName: cleanFranchiseName(f.displayName) }]));

      return {
        ...shipment[0],
        items,
        tracking: trackingHistory,
        originFranchise: franchiseMap.get(shipment[0].originFranchiseId),
        destinationFranchise: franchiseMap.get(shipment[0].destinationFranchiseId),
        currentLocation: franchiseMap.get(shipment[0].currentLocationId),
      };
    }),

  // ─── Get Bitácora (multiple shipments for delivery manifest) ───
  getBitacora: franchiseAuthedQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      const isWarehouse = userFranchise[0]?.isWarehouse === 1;

      const result = await db
        .select({
          id: shipments.id,
          trackingNumber: shipments.trackingNumber,
          invoiceNumber: shipments.invoiceNumber,
          senderName: shipments.senderName,
          senderPhone: shipments.senderPhone,
          receiverName: shipments.receiverName,
          originFranchiseId: shipments.originFranchiseId,
          destinationFranchiseId: shipments.destinationFranchiseId,
          currentLocationId: shipments.currentLocationId,
          status: shipments.status,
          notes: shipments.notes,
          createdAt: shipments.createdAt,
          originName: franchises.name,
          originDisplayName: franchises.displayName,
          destinationName: sql<string>`(SELECT f2.name FROM franchises f2 WHERE f2.id = ${shipments.destinationFranchiseId})`,
          destinationDisplayName: sql<string>`(SELECT f2.displayName FROM franchises f2 WHERE f2.id = ${shipments.destinationFranchiseId})`,
        })
        .from(shipments)
        .leftJoin(franchises, eq(franchises.id, shipments.originFranchiseId))
        .where(inArray(shipments.id, input.ids))
        .orderBy(desc(shipments.createdAt));

      // Filter: user can only see shipments related to their franchise
      const filtered = result.filter(s =>
        s.originFranchiseId === franchiseId ||
        s.destinationFranchiseId === franchiseId ||
        s.currentLocationId === franchiseId ||
        (isWarehouse && (s.status === "ENVIADO_A_BODEGA" || s.status === "RECIBIDO_EN_BODEGA" || s.status === "ENVIADO_A_DESTINO"))
      );

      if (filtered.length === 0) {
        return { shipments: [], totalPackages: 0, generatedAt: new Date() };
      }

      // Get items for allowed shipments only
      const allowedIds = filtered.map(s => s.id);
      const items = await db
        .select()
        .from(shipmentItems)
        .where(inArray(shipmentItems.shipmentId, allowedIds));

      const itemsByShipment = new Map<number, typeof items>();
      for (const item of items) {
        if (!itemsByShipment.has(item.shipmentId)) itemsByShipment.set(item.shipmentId, []);
        itemsByShipment.get(item.shipmentId)!.push(item);
      }

      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map(f => [f.id, { ...f, displayName: cleanFranchiseName(f.displayName) }]));

      return {
        shipments: filtered.map(s => ({
          ...s,
          items: itemsByShipment.get(s.id) || [],
          originDisplayName: cleanFranchiseName(s.originDisplayName),
          destinationDisplayName: cleanFranchiseName(s.destinationDisplayName),
          destinationFranchise: franchiseMap.get(s.destinationFranchiseId),
        })),
        totalPackages: filtered.length,
        generatedAt: new Date(),
      };
    }),

  // ─── Confirmar Salida Masiva a Bodega ─────────────────────────
  confirmarSalidaMasiva: franchiseAuthedQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;

      // Obtener todas las bodegas
      const bodegaResult = await db.select().from(franchises).where(eq(franchises.isWarehouse, 1));
      const bodegaPavon = bodegaResult.find(b => b.code === "bodega");
      const bodegaCedi = bodegaResult.find(b => b.code === "bodega_cedi");

      // Obtener todos los envíos solicitados
      const envios = await db.select().from(shipments).where(inArray(shipments.id, input.ids));

      if (envios.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No se encontraron envios" });
      }

      // Validar que todos los envíos pertenezcan a la franquicia del usuario y estén en CREADO
      const invalidos = envios.filter((s) => s.originFranchiseId !== franchiseId || s.status !== "CREADO");
      if (invalidos.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${invalidos.length} envio(s) no pueden ser procesados. Solo se puede dar salida a envios en estado CREADO de esta tienda.`,
        });
      }

      // Update each shipment individually to the correct warehouse
      for (const envio of envios) {
        const targetBodega = envio.warehouseLocation;
        let targetBodegaId: number | null = null;
        let targetBodegaName = "bodega";

        if (targetBodega === "Bodega Cedi" && bodegaCedi) {
          targetBodegaId = bodegaCedi.id;
          targetBodegaName = bodegaCedi.name;
        } else if (bodegaPavon) {
          targetBodegaId = bodegaPavon.id;
          targetBodegaName = bodegaPavon.name;
        }

        if (!targetBodegaId) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Bodega destino no encontrada para ${envio.trackingNumber}` });
        }

        await db
          .update(shipments)
          .set({ status: "ENVIADO_A_BODEGA", currentLocationId: targetBodegaId })
          .where(eq(shipments.id, envio.id));

        await db.insert(shipmentTracking).values({
          shipmentId: envio.id,
          status: "ENVIADO_A_BODEGA",
          locationId: targetBodegaId,
          notes: `Salida confirmada - En camion hacia ${targetBodegaName}`,
          createdBy: ctx.franchiseUser!.id,
        });
      }

      return { success: true, count: envios.length };
    }),

  // ─── Recibir en Bodega Masiva ─────────────────────────────────
  recibirEnBodegaMasiva: franchiseAuthedQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;

      // Verificar que el usuario sea bodega
      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      if (userFranchise[0]?.isWarehouse !== 1) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo la bodega puede recibir envios" });
      }

      const envios = await db.select().from(shipments).where(inArray(shipments.id, input.ids));
      if (envios.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontraron envios" });

      // Validar que todos esten en ENVIADO_A_BODEGA
      const invalidos = envios.filter((s) => s.status !== "ENVIADO_A_BODEGA");
      if (invalidos.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${invalidos.length} envio(s) no estan en estado ENVIADO_A_BODEGA y no pueden ser recibidos` });
      }

      // Determine this warehouse's name for tracking
      const myBodegaName = userFranchise[0]?.name || "";
      const normalizedName = myBodegaName.toLowerCase().includes("cedi") ? "Bodega Cedi" : "Bodega Pavon";

      await db
        .update(shipments)
        .set({ status: "RECIBIDO_EN_BODEGA", currentLocationId: franchiseId, warehouseLocation: normalizedName })
        .where(inArray(shipments.id, input.ids));

      for (const envio of envios) {
        await db.insert(shipmentTracking).values({
          shipmentId: envio.id,
          status: "RECIBIDO_EN_BODEGA",
          locationId: franchiseId,
          notes: `Recibido en ${normalizedName} (${envios.length} envios en lote)`,
          createdBy: ctx.franchiseUser!.id,
        });
      }

      return { success: true, count: envios.length };
    }),

  // ─── Enviar a Destino Masiva ──────────────────────────────────
  enviarADestinoMasiva: franchiseAuthedQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;

      // Verificar que el usuario sea bodega
      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      if (userFranchise[0]?.isWarehouse !== 1) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo la bodega puede enviar envios a destino" });
      }

      const envios = await db.select().from(shipments).where(inArray(shipments.id, input.ids));
      if (envios.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontraron envios" });

      // Validar que todos esten en RECIBIDO_EN_BODEGA o CREADO (bodega puede enviar ambos)
      const invalidos = envios.filter((s) => s.status !== "RECIBIDO_EN_BODEGA" && s.status !== "CREADO");
      if (invalidos.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${invalidos.length} envio(s) no estan en estado valido para enviar a destino` });
      }

      // Determine this warehouse's name for tracking
      const myBodegaName = userFranchise[0]?.name || "";
      const normalizedName = myBodegaName.toLowerCase().includes("cedi") ? "Bodega Cedi" : "Bodega Pavon";

      await db
        .update(shipments)
        .set({ status: "ENVIADO_A_DESTINO" })
        .where(inArray(shipments.id, input.ids));

      for (const envio of envios) {
        await db.insert(shipmentTracking).values({
          shipmentId: envio.id,
          status: "ENVIADO_A_DESTINO",
          locationId: franchiseId,
          notes: `Enviado a destino desde ${normalizedName} (${envios.length} envios en lote)`,
          createdBy: ctx.franchiseUser!.id,
        });
      }

      return { success: true, count: envios.length };
    }),

  // ─── Enviar a Inter-Bodega Masiva ──────────────────────────────
  // Used when bodega sends packages to another bodega (e.g. Bodega Pavon -> Bodega Cedi)
  enviarAInterBodegaMasiva: franchiseAuthedQuery
    .input(z.object({ ids: z.array(z.number()).min(1), targetBodega: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;

      // Verificar que el usuario sea bodega
      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      if (userFranchise[0]?.isWarehouse !== 1) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo la bodega puede enviar envios a otra bodega" });
      }

      const envios = await db.select().from(shipments).where(inArray(shipments.id, input.ids));
      if (envios.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontraron envios" });

      // Validar que todos esten en RECIBIDO_EN_BODEGA o CREADO
      const invalidos = envios.filter((s) => s.status !== "RECIBIDO_EN_BODEGA" && s.status !== "CREADO");
      if (invalidos.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${invalidos.length} envio(s) no estan en estado valido para enviar a otra bodega` });
      }

      // Determine this warehouse's name for tracking
      const myBodegaName = userFranchise[0]?.name || "";
      const myName = myBodegaName.toLowerCase().includes("cedi") ? "Bodega Cedi" : "Bodega Pavon";

      // Inter-bodega: set warehouseLocation to TARGET bodega so it appears
      // in the destination bodega's "Por Recibir" filter
      await db
        .update(shipments)
        .set({ status: "ENVIADO_A_BODEGA", warehouseLocation: input.targetBodega })
        .where(inArray(shipments.id, input.ids));

      for (const envio of envios) {
        await db.insert(shipmentTracking).values({
          shipmentId: envio.id,
          status: "ENVIADO_A_BODEGA",
          locationId: franchiseId,
          notes: `Enviado desde ${myName} hacia ${input.targetBodega} (${envios.length} envios en lote)`,
          createdBy: ctx.franchiseUser!.id,
        });
      }

      return { success: true, count: envios.length };
    }),
  recibirEnDestinoMasiva: franchiseAuthedQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;

      // Verificar que NO sea bodega (solo tiendas)
      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      if (userFranchise[0]?.isWarehouse === 1) {
        throw new TRPCError({ code: "FORBIDDEN", message: "La bodega usa su propio flujo de recepcion" });
      }

      const envios = await db.select().from(shipments).where(inArray(shipments.id, input.ids));
      if (envios.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontraron envios" });

      // Validar que todos esten en ENVIADO_A_DESTINO y vayan a esta tienda
      const invalidos = envios.filter((s) => s.status !== "ENVIADO_A_DESTINO" || s.destinationFranchiseId !== franchiseId);
      if (invalidos.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${invalidos.length} envio(s) no estan en estado ENVIADO_A_DESTINO o no pertenecen a esta tienda` });
      }

      await db
        .update(shipments)
        .set({ status: "RECIBIDO_EN_DESTINO", currentLocationId: franchiseId })
        .where(inArray(shipments.id, input.ids));

      for (const envio of envios) {
        await db.insert(shipmentTracking).values({
          shipmentId: envio.id,
          status: "RECIBIDO_EN_DESTINO",
          locationId: franchiseId,
          notes: `Recibido en tienda destino (${envios.length} envios en lote)`,
          createdBy: ctx.franchiseUser!.id,
        });
      }

      return { success: true, count: envios.length };
    }),

  // ─── MONTHLY REPORT BY FRANCHISE ──────────────────────────────
  monthlyReport: publicQuery
    .input(z.object({
      year: z.number().optional(),
      month: z.number().min(1).max(12).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const now = new Date();
      const year = input?.year ?? now.getFullYear();
      const month = input?.month ?? now.getMonth() + 1;

      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map(f => [f.id, { ...f, displayName: cleanFranchiseName(f.displayName) }]));

      const allShipments = await db.select().from(shipments);

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);

      const monthlyShipments = allShipments.filter(s => {
        const created = new Date(s.createdAt);
        return created >= startDate && created < endDate;
      });

      const statsByFranchise = new Map<number, {
        franchise: typeof allFranchises[0];
        created: number;
        sentToWarehouse: number;
        receivedInWarehouse: number;
        sentToDestination: number;
        receivedAtDestination: number;
      }>();

      for (const f of allFranchises) {
        statsByFranchise.set(f.id, {
          franchise: f,
          created: 0,
          sentToWarehouse: 0,
          receivedInWarehouse: 0,
          sentToDestination: 0,
          receivedAtDestination: 0,
        });
      }

      for (const s of monthlyShipments) {
        const origin = statsByFranchise.get(s.originFranchiseId);
        if (origin) origin.created++;

        if (s.status === "ENVIADO_A_BODEGA" || s.status === "RECIBIDO_EN_BODEGA" || s.status === "ENVIADO_A_DESTINO" || s.status === "RECIBIDO_EN_DESTINO") {
          const origin2 = statsByFranchise.get(s.originFranchiseId);
          if (origin2) origin2.sentToWarehouse++;
        }
        if (s.status === "RECIBIDO_EN_BODEGA" || s.status === "ENVIADO_A_DESTINO" || s.status === "RECIBIDO_EN_DESTINO") {
          const warehouse = statsByFranchise.get(s.currentLocationId);
          if (warehouse) warehouse.receivedInWarehouse++;
        }
        if (s.status === "ENVIADO_A_DESTINO" || s.status === "RECIBIDO_EN_DESTINO") {
          const dest = statsByFranchise.get(s.currentLocationId);
          if (dest) dest.sentToDestination++;
        }
        if (s.status === "RECIBIDO_EN_DESTINO") {
          const dest = statsByFranchise.get(s.destinationFranchiseId);
          if (dest) dest.receivedAtDestination++;
        }
      }

      const total = monthlyShipments.length;

      return {
        year,
        month,
        totalShipments: total,
        byFranchise: Array.from(statsByFranchise.values()).filter(s => s.created > 0 || s.receivedAtDestination > 0),
        period: `${month}/${year}`,
      };
    }),
});
