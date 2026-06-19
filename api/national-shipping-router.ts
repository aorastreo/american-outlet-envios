import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { createRouter, franchiseAuthedQuery } from "./middleware";
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

async function generateTrackingNumber(): Promise<string> {
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

      const trackingNumber = await generateTrackingNumber();

      const result = await db.insert(nationalShipments).values({
        trackingNumber,
        senderName: ctx.franchiseUser!.displayName || "Tienda",
        originFranchiseId,
        receiverName: input.receiverName.trim(),
        receiverPhone: input.receiverPhone.trim(),
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

  // ─── List (por tienda o bodega) ────────────────────────────
  list: franchiseAuthedQuery
    .query(async ({ ctx }) => {
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

      return result;
    }),

  // ─── Delete ────────────────────────────────────────────────
  delete: franchiseAuthedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const isWarehouse = ctx.franchiseUser!.franchise?.isWarehouse === 1;

      const existing = await db
        .select()
        .from(nationalShipments)
        .where(eq(nationalShipments.id, input.id))
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Envio no encontrado" });
      }

      if (!isWarehouse && existing[0].originFranchiseId !== franchiseId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No tiene permiso para eliminar este envio" });
      }

      await db.delete(nationalShipments).where(eq(nationalShipments.id, input.id));
      return { success: true };
    }),
});