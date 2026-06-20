import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { createRouter, franchiseAuthedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { nationalShipments } from "@db/schema";

export const nationalShippingRouter = createRouter({
  // ─── Create National Shipment ─────────────────────────────────
  create: franchiseAuthedQuery
    .input(
      z.object({
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
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser.franchiseId;
      const createdBy = ctx.franchiseUser.id;

      const result = await db.insert(nationalShipments).values({
        franchiseId,
        receiverName: input.receiverName,
        receiverPhone: input.receiverPhone,
        province: input.province,
        canton: input.canton,
        district: input.district,
        deliveryAddress: input.deliveryAddress,
        description: input.description,
        notes: input.notes,
        packageSize: input.packageSize,
        paymentMethod: input.paymentMethod,
        createdBy,
      });

      return { id: Number(result[0].insertId) };
    }),

  // ─── List National Shipments ──────────────────────────────────
  list: franchiseAuthedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const franchiseId = ctx.franchiseUser.franchiseId;

    const results = await db
      .select()
      .from(nationalShipments)
      .where(eq(nationalShipments.franchiseId, franchiseId))
      .orderBy(desc(nationalShipments.createdAt));

    return results;
  }),

  // ─── Get By ID (for boleta) ─────────────────────────────────
  getById: franchiseAuthedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser.franchiseId;

      const result = await db
        .select()
        .from(nationalShipments)
        .where(eq(nationalShipments.id, input.id))
        .limit(1);

      if (result.length === 0) {
        throw new Error("Envio no encontrado");
      }

      const shipment = result[0];
      if (shipment.franchiseId !== franchiseId) {
        throw new Error("No tiene permiso para ver este envio");
      }

      return shipment;
    }),

  // ─── Get Bitacora (multiple IDs) ──────────────────────────────
  getBitacora: franchiseAuthedQuery
    .input(z.object({ ids: z.array(z.number()) }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser.franchiseId;

      const results = await db
        .select()
        .from(nationalShipments)
        .where(eq(nationalShipments.franchiseId, franchiseId))
        .orderBy(desc(nationalShipments.createdAt));

      const filtered = results.filter((s) => input.ids.includes(s.id));

      return {
        shipments: filtered,
        totalShipments: filtered.length,
        generatedAt: new Date(),
      };
    }),

  // ─── Delete National Shipment ─────────────────────────────────
  delete: franchiseAuthedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser.franchiseId;

      const existing = await db
        .select()
        .from(nationalShipments)
        .where(eq(nationalShipments.id, input.id))
        .limit(1);

      if (existing.length === 0) {
        throw new Error("Envio no encontrado");
      }

      if (existing[0].franchiseId !== franchiseId) {
        throw new Error("No tiene permiso para eliminar este envio");
      }

      await db
        .delete(nationalShipments)
        .where(eq(nationalShipments.id, input.id));

      return { success: true };
    }),
});
