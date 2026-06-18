import { z } from "zod";
import { eq, or, desc, sql, inArray } from "drizzle-orm";
import { createRouter, publicQuery, franchiseAuthedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  shipments,
  shipmentItems,
  shipmentTracking,
  franchises,
  franchiseUsers,
  nationalShipments,
} from "@db/schema";
import { TRPCError } from "@trpc/server";

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

      const bodegaResult = await db.select().from(franchises).where(eq(franchises.isWarehouse, 1)).limit(1);
      const bodegaId = bodegaResult[0]?.id;

      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, originId)).limit(1);
      const originIsWarehouse = userFranchise[0]?.isWarehouse === 1;

      if (originIsWarehouse && input.destinationFranchiseId === bodegaId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La bodega no puede enviar envios a si misma" });
      }

      if (input.invoiceNumber?.trim()) {
        const existingInvoice = await db.select().from(shipments).where(eq(shipments.invoiceNumber, input.invoiceNumber.trim())).limit(1);
        if (existingInvoice.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: `Ya existe un envio con la factura #${input.invoiceNumber.trim()}` });
        }
      }

      if (!bodegaId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Bodega no configurada" });
      // Check if this is a pickup route (destination is Grecia=5, SanRamon=6, Palmares=7)
      const isPickup = [5, 6, 7].includes(input.destinationFranchiseId);
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

      const conditions = [
        eq(shipments.originFranchiseId, franchiseId),
        eq(shipments.destinationFranchiseId, franchiseId),
        eq(shipments.currentLocationId, franchiseId),
      ];
      if (isWarehouse) conditions.push(eq(shipments.status, "ENVIADO_A_BODEGA"));
      conditions.push(sql`${shipments.status} = 'ENVIADO_A_DESTINO' AND ${shipments.destinationFranchiseId} = ${franchiseId}`);

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
          createdBy: shipments.createdBy,
          originName: franchises.name,
          destinationName: sql<string>`(SELECT f2.name FROM franchises f2 WHERE f2.id = ${shipments.destinationFranchiseId})`,
          currentLocationName: sql<string>`(SELECT f3.name FROM franchises f3 WHERE f3.id = ${shipments.currentLocationId})`,
        })
        .from(shipments)
        .leftJoin(franchises, eq(franchises.id, shipments.originFranchiseId))
        .where(or(...conditions))
        .orderBy(desc(shipments.createdAt))
        .limit(pageSize)
        .offset(offset);

      return result;
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
      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

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
      const bodegaResult = await db.select().from(franchises).where(eq(franchises.isWarehouse, 1)).limit(1);
      const bodegaId = bodegaResult[0]?.id;
      const originIsWarehouse = shipment.originFranchiseId === bodegaId;

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
      if (input.newStatus === "ENVIADO_A_BODEGA") newLocationId = bodegaId || shipment.currentLocationId;
      else if (input.newStatus === "RECIBIDO_EN_BODEGA") newLocationId = bodegaId || shipment.currentLocationId;
      else if (input.newStatus === "ENVIADO_A_DESTINO") newLocationId = shipment.destinationFranchiseId;
      else if (input.newStatus === "RECIBIDO_EN_DESTINO") newLocationId = shipment.destinationFranchiseId;

      // Build update data
      const updateData: Record<string, any> = {
        status: input.newStatus,
        currentLocationId: newLocationId,
      };
      if (input.newStatus === "RECIBIDO_EN_DESTINO" && input.receiverName?.trim()) {
        updateData.receiverName = input.receiverName.trim();
      }

      await db.update(shipments).set(updateData).where(eq(shipments.id, input.id));

      const statusNotes: Record<string, string> = {
        ENVIADO_A_BODEGA: "Enviado a bodega por tienda de origen",
        RECIBIDO_EN_BODEGA: "Recibido en bodega",
        ENVIADO_A_DESTINO: originIsWarehouse ? "Enviado directamente desde bodega a tienda de destino" : "Enviado a tienda de destino desde bodega",
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

      // 1. Try local shipments first (AO-XXXX)
      const localShipment = await db.select().from(shipments).where(eq(shipments.trackingNumber, input.trackingNumber)).limit(1);

      if (localShipment.length > 0) {
        const s = localShipment[0];
        const items = await db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, s.id));
        const trackingHistory = await db.select().from(shipmentTracking).where(eq(shipmentTracking.shipmentId, s.id)).orderBy(shipmentTracking.createdAt);
        const allFranchises = await db.select().from(franchises);
        const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));
        const destFranchise = franchiseMap.get(s.destinationFranchiseId);
        const pickupCodes = ["grecia", "san_ramon", "palmares"];
        const isPickupRoute = pickupCodes.includes(destFranchise?.code?.toLowerCase() || "") ||
                              (destFranchise?.displayName?.toLowerCase() || "").includes("recogida");

        return {
          ...s,
          items,
          tracking: trackingHistory,
          originFranchise: franchiseMap.get(s.originFranchiseId),
          destinationFranchise: destFranchise,
          destinationFranchiseId: s.destinationFranchiseId,
          currentLocation: franchiseMap.get(s.currentLocationId),
          isPickupRoute,
          isNational: false,
        };
      }

      // 2. Try national shipments (AN-XXXX)
      const nationalShipment = await db.select().from(nationalShipments).where(eq(nationalShipments.trackingNumber, input.trackingNumber)).limit(1);

      if (nationalShipment.length > 0) {
        const s = nationalShipment[0];
        const allFranchises = await db.select().from(franchises);
        const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));
        const originFranchise = franchiseMap.get(s.originFranchiseId);

        // Build pseudo-tracking history
        const pseudoTracking = [
          { id: 1, shipmentId: s.id, status: "CREADO", locationId: 0, notes: "Envio creado", createdBy: s.createdBy, createdAt: s.createdAt },
        ];
        if (s.status === "SOLICITADO_RECOLECCION" || s.status === "RECOLECTADO" || s.status === "ENTREGADO") {
          pseudoTracking.push({ id: 2, shipmentId: s.id, status: "SOLICITADO_RECOLECCION", locationId: 0, notes: "Recoleccion solicitada", createdBy: s.createdBy, createdAt: s.createdAt });
        }
        if (s.status === "RECOLECTADO" || s.status === "ENTREGADO") {
          pseudoTracking.push({ id: 3, shipmentId: s.id, status: "RECOLECTADO", locationId: 0, notes: "En transito hacia destino", createdBy: s.createdBy, createdAt: s.createdAt });
        }
        if (s.status === "ENTREGADO") {
          pseudoTracking.push({ id: 4, shipmentId: s.id, status: "ENTREGADO", locationId: 0, notes: `Entregado a ${s.deliveredTo || "cliente"}`, createdBy: s.createdBy, createdAt: s.deliveredAt || s.createdAt });
        }

        return {
          id: s.id,
          trackingNumber: s.trackingNumber,
          invoiceNumber: null,
          senderName: originFranchise?.displayName || "Tienda",
          senderPhone: s.senderPhone || "",
          originFranchiseId: s.originFranchiseId,
          destinationFranchiseId: 0,
          currentLocationId: 0,
          status: s.status,
          receiverName: s.receiverName,
          notes: s.notes,
          createdBy: s.createdBy,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          items: [],
          tracking: pseudoTracking,
          originFranchise,
          destinationFranchise: {
            id: 0,
            name: `${s.province}, ${s.canton}`,
            displayName: `${s.province}, ${s.canton}`,
            code: "NACIONAL",
            isWarehouse: 0,
          },
          destinationFranchiseId: 0,
          currentLocation: originFranchise,
          isPickupRoute: true,
          isNational: true,
        };
      }

      throw new TRPCError({ code: "NOT_FOUND", message: "Numero de rastreo no encontrado" });
    }),

      const items = await db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, shipment[0].id));
      const trackingHistory = await db.select().from(shipmentTracking).where(eq(shipmentTracking.shipmentId, shipment[0].id)).orderBy(shipmentTracking.createdAt);

      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

      const destFranchise = franchiseMap.get(shipment[0].destinationFranchiseId);
      const pickupCodes = ["grecia", "san_ramon", "palmares"];
      const isPickupRoute = pickupCodes.includes(destFranchise?.code?.toLowerCase() || "") ||
                            (destFranchise?.displayName?.toLowerCase() || "").includes("recogida");

      return {
        ...shipment[0],
        items,
        tracking: trackingHistory,
        originFranchise: franchiseMap.get(shipment[0].originFranchiseId),
        destinationFranchise: franchiseMap.get(shipment[0].destinationFranchiseId),
        destinationFranchiseId: shipment[0].destinationFranchiseId,
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

    const conditions = [
      eq(shipments.originFranchiseId, franchiseId),
      eq(shipments.destinationFranchiseId, franchiseId),
      eq(shipments.currentLocationId, franchiseId),
    ];
    if (isWarehouse) conditions.push(eq(shipments.status, "ENVIADO_A_BODEGA"));
    conditions.push(sql`${shipments.status} = 'ENVIADO_A_DESTINO' AND ${shipments.destinationFranchiseId} = ${franchiseId}`);

    const allShipments = await db.select().from(shipments).where(or(...conditions));
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

    const conditions: any[] = [
      sql`${shipments.status} = 'ENVIADO_A_DESTINO' AND ${shipments.destinationFranchiseId} = ${franchiseId}`,
    ];

    if (isWarehouse) {
      conditions.push(eq(shipments.status, "ENVIADO_A_BODEGA"));
    } else {
      conditions.push(sql`${shipments.status} = 'CREADO' AND ${shipments.originFranchiseId} = ${franchiseId}`);
    }

    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(shipments)
      .where(or(...conditions));

    return countResult[0]?.count || 0;
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
      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

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
      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

      return {
        shipments: filtered.map(s => ({
          ...s,
          items: itemsByShipment.get(s.id) || [],
          destinationFranchise: franchiseMap.get(s.destinationFranchiseId),
        })),
        totalPackages: filtered.length,
        generatedAt: new Date(),
      };
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
      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

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
