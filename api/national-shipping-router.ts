import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { createRouter, franchiseAuthedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { nationalShipments, franchises } from "@db/schema";

function cleanFranchiseName(name: string | null | undefined): string {
  if (!name) return "Tienda";
  return name.replace(/AMERICAN OUTLET\s*/i, "").trim() || name;
}

/** Keep legacy packageSize filled for old bitácoras; fee is the source of truth. */
function packageSizeForFee(shippingFee: number): "PEQUENO" | "MEDIANO" | "GRANDE" {
  if (shippingFee <= 0) return "PEQUENO";
  if (shippingFee <= 1000) return "PEQUENO";
  if (shippingFee <= 3500) return "MEDIANO";
  return "GRANDE";
}

export const nationalShippingRouter = createRouter({
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
        invoiceNumber: z.string().optional(),
        shippingFee: z.number().int().min(0).max(9_999_999),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser.franchiseId;
      const createdBy = ctx.franchiseUser.id;
      const shippingFee = Math.max(0, Math.round(input.shippingFee));

      const result = await db.insert(nationalShipments).values({
        franchiseId,
        receiverName: input.receiverName.trim(),
        receiverPhone: input.receiverPhone.trim(),
        province: input.province,
        canton: input.canton,
        district: input.district,
        deliveryAddress: input.deliveryAddress.trim(),
        description: input.description.trim(),
        notes: input.notes?.trim() || null,
        invoiceNumber: input.invoiceNumber?.trim() || null,
        packageSize: packageSizeForFee(shippingFee),
        shippingFee,
        paymentMethod: "PAGA_ORIGEN",
        createdBy,
      });

      return { id: Number(result[0].insertId) };
    }),

  list: franchiseAuthedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const franchiseId = ctx.franchiseUser.franchiseId;

    return db
      .select()
      .from(nationalShipments)
      .where(eq(nationalShipments.franchiseId, franchiseId))
      .orderBy(desc(nationalShipments.createdAt));
  }),

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

      const franchise = await db
        .select({ displayName: franchises.displayName, name: franchises.name })
        .from(franchises)
        .where(eq(franchises.id, franchiseId))
        .limit(1);

      return {
        ...shipment,
        franchiseName: cleanFranchiseName(franchise[0]?.displayName || franchise[0]?.name),
      };
    }),

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

      const franchise = await db
        .select({ displayName: franchises.displayName, name: franchises.name })
        .from(franchises)
        .where(eq(franchises.id, franchiseId))
        .limit(1);

      const franchiseName = cleanFranchiseName(franchise[0]?.displayName || franchise[0]?.name);

      return {
        shipments: filtered.map((s) => ({ ...s, franchiseName })),
        totalShipments: filtered.length,
        franchiseName,
        generatedAt: new Date(),
      };
    }),

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

      await db.delete(nationalShipments).where(eq(nationalShipments.id, input.id));

      return { success: true };
    }),
});
