import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { createRouter, franchiseAuthedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { nationalShipments } from "@db/schema";
import { TRPCError } from "@trpc/server";

function randomDigit(): string {
  return String(Math.floor(Math.random() * 10));
}

function randomLetter(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return letters[Math.floor(Math.random() * letters.length)];
}

async function generateNationalTrackingNumber(): Promise<string> {
  const db = getDb();
  for (let attempt = 0; attempt < 10; attempt++) {
    let numberPart = "";
    for (let i = 0; i < 8; i++) {
      numberPart += randomDigit();
    }
    const letter = randomLetter();
    const trackingNumber = `AN${numberPart}${letter}`;

    const existing = await db
      .select({ trackingNumber: nationalShipments.trackingNumber })
      .from(nationalShipments)
      .where(eq(nationalShipments.trackingNumber, trackingNumber))
      .limit(1);

    if (existing.length === 0) {
      return trackingNumber;
    }
  }
  throw new Error("No se pudo generar un numero de guia unico");
}

export const nationalShippingRouter = createRouter({
  // ─── Create National Shipment ──────────────────────────────
  create: franchiseAuthedQuery
    .input(z.object({
      receiverName: z.string().min(1).max(255),
      receiverPhone: z.string().min(1).max(50),
      receiverId: z.string().max(50).optional(),
      receiverEmail: z.string().max(320).optional(),
      province: z.string().min(1).max(50),
      canton: z.string().min(1).max(50),
      district: z.string().min(1).max(50),
      deliveryAddress: z.string().min(1),
      description: z.string().min(1),
      notes: z.string().optional(),
      packageSize: z.enum(["PEQUENO", "MEDIANO", "GRANDE"]),
      paymentMethod: z.enum(["PAGA_ORIGEN", "COBRA_DESTINO"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const originFranchiseId = ctx.franchiseUser!.franchiseId;

      const costMap = { PEQUENO: 1000, MEDIANO: 3500, GRANDE: 6500 };
      const shippingCost = costMap[input.packageSize];

      const trackingNumber = await generateNationalTrackingNumber();

      const result = await db.insert(nationalShipments).values({
        trackingNumber,
        senderName: ctx.franchiseUser!.displayName || "Tienda",
        senderPhone: "",
        originFranchiseId,
        receiverName: input.receiverName.trim(),
        receiverPhone: input.receiverPhone.trim(),
        receiverId: input.receiverId?.trim() || null,
        receiverEmail: input.receiverEmail?.trim() || null,
        province: input.province,
        canton: input.canton,
        district: input.district,
        deliveryAddress: input.deliveryAddress.trim(),
        description: input.description.trim(),
        notes: input.notes?.trim() || null,
        packageSize: input.packageSize,
        shippingCost,
        paymentMethod: input.paymentMethod,
        createdBy: ctx.franchiseUser!.id,
      });

      return { success: true, shipmentId: Number(result[0].insertId), trackingNumber };
    }),

  // ─── Request Pickup ────────────────────────────────────────
  requestPickup: franchiseAuthedQuery
    .input(z.object({
      shipmentIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;

      for (const id of input.shipmentIds) {
        const existing = await db
          .select()
          .from(nationalShipments)
          .where(eq(nationalShipments.id, id))
          .limit(1);

        if (existing.length === 0 || existing[0].originFranchiseId !== franchiseId) {
          throw new TRPCError({ code: "FORBIDDEN", message: `Envio ${id} no encontrado o no pertenece a esta tienda` });
        }

        if (existing[0].status !== "CREADO") {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Envio ${existing[0].trackingNumber} no esta en estado CREADO` });
        }

        await db
          .update(nationalShipments)
          .set({ status: "SOLICITADO_RECOLECCION" })
          .where(eq(nationalShipments.id, id));
      }

      return { success: true, updated: input.shipmentIds.length };
    }),

  // ─── Mark as Collected (bodega/chofer) ─────────────────────
  markCollected: franchiseAuthedQuery
    .input(z.object({
      shipmentIds: z.array(z.number()).min(1),
      externalTrackingCode: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      for (const id of input.shipmentIds) {
        const updateData: Record<string, any> = { status: "RECOLECTADO" };
        if (input.externalTrackingCode) {
          updateData.externalTrackingCode = input.externalTrackingCode.trim();
        }

        await db
          .update(nationalShipments)
          .set(updateData)
          .where(eq(nationalShipments.id, id));
      }

      return { success: true, updated: input.shipmentIds.length };
    }),

  // ─── Mark as Delivered (transportista) ─────────────────────
  markDelivered: franchiseAuthedQuery
    .input(z.object({
      trackingNumber: z.string().min(1),
      deliveredTo: z.string().min(1).max(255),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const existing = await db
        .select()
        .from(nationalShipments)
        .where(eq(nationalShipments.trackingNumber, input.trackingNumber))
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Envio no encontrado" });
      }

      if (existing[0].status !== "RECOLECTADO") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El envio no esta en estado RECOLECTADO" });
      }

      await db
        .update(nationalShipments)
        .set({
          status: "ENTREGADO",
          deliveredTo: input.deliveredTo.trim(),
          deliveredAt: new Date(),
          notes: input.notes ? `${existing[0].notes || ""}\nEntregado: ${input.notes}` : existing[0].notes,
        })
        .where(eq(nationalShipments.id, existing[0].id));

      return { success: true };
    }),

  // ─── List (por tienda o bodega) ────────────────────────────
  list: franchiseAuthedQuery
    .input(z.object({
      status: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const isWarehouse = ctx.franchiseUser!.franchise?.isWarehouse === 1;

      const conditions = isWarehouse
        ? undefined
        : eq(nationalShipments.originFranchiseId, franchiseId);

      const result = await db
        .select()
        .from(nationalShipments)
        .where(conditions)
        .orderBy(desc(nationalShipments.createdAt));

      if (input?.status) {
        return result.filter(s => s.status === input.status);
      }

      return result;
    }),

  // ─── Public Track (anyone can use) ─────────────────────────
     track: publicQuery
    .input(z.object({ trackingNumber: z.string().min(1) }).optional())
    .query(async ({ input }) => {
      const db = getDb();

      const trackingNumber = input?.trackingNumber;
      if (!trackingNumber) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Numero de guia requerido" });
      }

      const result = await db
        .select()
        .from(nationalShipments)
        .where(eq(nationalShipments.trackingNumber, trackingNumber))
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Envio no encontrado" });
      }

      const s = result[0];
      return {
        trackingNumber: s.trackingNumber,
        status: s.status,
        receiverName: s.receiverName,
        province: s.province,
        canton: s.canton,
        district: s.district,
        packageSize: s.packageSize,
        shippingCost: s.shippingCost,
        paymentMethod: s.paymentMethod,
        paymentStatus: s.paymentStatus,
        externalTrackingCode: s.externalTrackingCode,
        createdAt: s.createdAt,
        deliveredAt: s.deliveredAt,
        deliveredTo: s.deliveredTo,
      };
    }),
});