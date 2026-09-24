import { z } from "zod";
import { TRPCError } from "@trpc/trpc";
import { eq, or, and, desc, sql, inArray } from "drizzle-orm";
import {
  warranties,
  warrantyTracking,
  franchises,
} from "@db/schema";
import { franchiseAuthedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";

function generateWarrantyTrackingNumber(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "G";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const warrantyRouter = {
  // ─── Create Warranty ───────────────────────────────────────────
  create: franchiseAuthedQuery
    .input(
      z.object({
        invoiceNumber: z.string().min(1),
        senderName: z.string().min(1),
        senderPhone: z.string().min(1),
        productDescription: z.string().min(1),
        defectDescription: z.string().min(1),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const userId = ctx.franchiseUser!.id;

      const trackingNumber = generateWarrantyTrackingNumber();

      const result = await db.insert(warranties).values({
        trackingNumber,
        invoiceNumber: input.invoiceNumber,
        senderName: input.senderName,
        senderPhone: input.senderPhone,
        productDescription: input.productDescription,
        defectDescription: input.defectDescription,
        originFranchiseId: franchiseId,
        currentLocationId: franchiseId,
        status: "CREADA",
        notes: input.notes || null,
        createdBy: userId,
      });

      const warrantyId = Number(result[0].insertId);

      await db.insert(warrantyTracking).values({
        warrantyId,
        status: "CREADA",
        locationId: franchiseId,
        notes: "Garantia registrada en tienda",
        createdBy: userId,
      });

      return { success: true, trackingNumber, id: warrantyId };
    }),

  // ─── List Warranties (filtered by franchise/warehouse) ─────────
  list: franchiseAuthedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const franchiseId = ctx.franchiseUser!.franchiseId;

    const userFranchise = await db
      .select()
      .from(franchises)
      .where(eq(franchises.id, franchiseId))
      .limit(1);
    const isWarehouse = userFranchise[0]?.isWarehouse === 1;
    const isCedi = userFranchise[0]?.name?.toLowerCase().includes("cedi");

    let whereClause;
    if (isWarehouse && isCedi) {
      // CEDI sees warranties that are at CEDI or in transit to CEDI
      whereClause = or(
        eq(warranties.status, "ENVIADO_A_CEDI"),
        eq(warranties.status, "RECIBIDO_EN_CEDI"),
        eq(warranties.status, "EN_REPARACION"),
        eq(warranties.status, "REPARADO"),
        eq(warranties.status, "ENVIADO_A_TIENDA")
      );
    } else {
      // Stores see warranties they created or that are back at their store
      whereClause = or(
        eq(warranties.originFranchiseId, franchiseId),
        and(
          eq(warranties.currentLocationId, franchiseId),
          eq(warranties.status, "RECIBIDO_EN_TIENDA")
        )
      );
    }

    const allWarranties = await db
      .select()
      .from(warranties)
      .where(whereClause)
      .orderBy(desc(warranties.createdAt));

    const allFranchises = await db.select().from(franchises);
    const franchiseMap = new Map(allFranchises.map((f) => [f.id, f]));

    return allWarranties.map((w) => ({
      ...w,
      originFranchise: franchiseMap.get(w.originFranchiseId),
      currentLocation: franchiseMap.get(w.currentLocationId),
    }));
  }),

  // ─── Update Warranty Status ────────────────────────────────────
  updateStatus: franchiseAuthedQuery
    .input(
      z.object({
        id: z.number(),
        status: z.enum([
          "ENVIADO_A_CEDI",
          "RECIBIDO_EN_CEDI",
          "EN_REPARACION",
          "REPARADO",
          "ENVIADO_A_TIENDA",
          "RECIBIDO_EN_TIENDA",
          "ENTREGADO_AL_CLIENTE",
        ]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.franchiseUser!.id;
      const franchiseId = ctx.franchiseUser!.franchiseId;

      const existing = await db
        .select()
        .from(warranties)
        .where(eq(warranties.id, input.id))
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Garantia no encontrada" });
      }

      await db
        .update(warranties)
        .set({
          status: input.status,
          currentLocationId: franchiseId,
          updatedAt: new Date(),
        })
        .where(eq(warranties.id, input.id));

      await db.insert(warrantyTracking).values({
        warrantyId: input.id,
        status: input.status,
        locationId: franchiseId,
        notes: input.notes || `Estado actualizado a ${input.status}`,
        createdBy: userId,
      });

      return { success: true };
    }),

  // ─── Get Warranty by ID ────────────────────────────────────────
  getById: franchiseAuthedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(warranties)
        .where(eq(warranties.id, input.id))
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Garantia no encontrada" });
      }

      const tracking = await db
        .select()
        .from(warrantyTracking)
        .where(eq(warrantyTracking.warrantyId, input.id))
        .orderBy(desc(warrantyTracking.createdAt));

      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map((f) => [f.id, f]));

      return {
        ...result[0],
        tracking,
        originFranchise: franchiseMap.get(result[0].originFranchiseId),
        currentLocation: franchiseMap.get(result[0].currentLocationId),
      };
    }),

  // ─── Public Track Warranty ─────────────────────────────────────
  track: publicQuery
    .input(z.object({ trackingNumber: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(warranties)
        .where(eq(warranties.trackingNumber, input.trackingNumber))
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Numero de garantia no encontrado" });
      }

      const tracking = await db
        .select()
        .from(warrantyTracking)
        .where(eq(warrantyTracking.warrantyId, result[0].id))
        .orderBy(warrantyTracking.createdAt);

      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map((f) => [f.id, f]));

      return {
        ...result[0],
        tracking,
        originFranchise: franchiseMap.get(result[0].originFranchiseId),
        currentLocation: franchiseMap.get(result[0].currentLocationId),
      };
    }),

  // ─── Stats ─────────────────────────────────────────────────────
  stats: franchiseAuthedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const franchiseId = ctx.franchiseUser!.franchiseId;

    const userFranchise = await db
      .select()
      .from(franchises)
      .where(eq(franchises.id, franchiseId))
      .limit(1);
    const isWarehouse = userFranchise[0]?.isWarehouse === 1;
    const isCedi = userFranchise[0]?.name?.toLowerCase().includes("cedi");

    let whereClause;
    if (isWarehouse && isCedi) {
      whereClause = or(
        eq(warranties.status, "ENVIADO_A_CEDI"),
        eq(warranties.status, "RECIBIDO_EN_CEDI"),
        eq(warranties.status, "EN_REPARACION"),
        eq(warranties.status, "REPARADO"),
        eq(warranties.status, "ENVIADO_A_TIENDA")
      );
    } else {
      whereClause = or(
        eq(warranties.originFranchiseId, franchiseId),
        and(
          eq(warranties.currentLocationId, franchiseId),
          eq(warranties.status, "RECIBIDO_EN_TIENDA")
        )
      );
    }

    const allWarranties = await db
      .select()
      .from(warranties)
      .where(whereClause);

    const counts: Record<string, number> = {
      CREADA: 0,
      ENVIADO_A_CEDI: 0,
      RECIBIDO_EN_CEDI: 0,
      EN_REPARACION: 0,
      REPARADO: 0,
      ENVIADO_A_TIENDA: 0,
      RECIBIDO_EN_TIENDA: 0,
      ENTREGADO_AL_CLIENTE: 0,
    };

    for (const w of allWarranties) {
      counts[w.status] = (counts[w.status] || 0) + 1;
    }

    return counts;
  }),
};

