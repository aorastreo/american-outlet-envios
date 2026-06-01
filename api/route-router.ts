import { z } from "zod";
import { eq, inArray, asc } from "drizzle-orm";
import { createRouter, franchiseAuthedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { deliveryRoutes, routeStops, routeShipments, shipments, shipmentItems, shipmentTracking, franchises } from "@db/schema";
import { TRPCError } from "@trpc/server";

export const routeRouter = createRouter({
  create: franchiseAuthedQuery
    .input(z.object({
      name: z.string().min(1).max(255),
      stops: z.array(z.object({
        cityName: z.string().min(1).max(100),
      })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const routeResult = await db.insert(deliveryRoutes).values({
        name: input.name,
        status: "PLANIFICADA",
        createdBy: ctx.franchiseUser!.id,
      });
      const routeId = Number(routeResult[0].insertId);

      for (let i = 0; i < input.stops.length; i++) {
        await db.insert(routeStops).values({
          routeId,
          cityName: input.stops[i].cityName,
          stopOrder: i + 1,
        });
      }

      return { success: true, routeId };
    }),

  list: franchiseAuthedQuery
    .input(z.object({
      status: z.enum(["PLANIFICADA", "EN_RUTA", "COMPLETADA", "CANCELADA"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = input?.status ? eq(deliveryRoutes.status, input.status) : undefined;
      const result = conditions
        ? await db.select().from(deliveryRoutes).where(conditions).orderBy(deliveryRoutes.createdAt)
        : await db.select().from(deliveryRoutes).orderBy(deliveryRoutes.createdAt);
      return result;
    }),

  getById: franchiseAuthedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const route = await db.select().from(deliveryRoutes).where(eq(deliveryRoutes.id, input.id)).limit(1);
      if (route.length === 0) return null;

      const stops = await db.select().from(routeStops)
        .where(eq(routeStops.routeId, input.id))
        .orderBy(asc(routeStops.stopOrder));

      const allRouteShipments = await db.select().from(routeShipments)
        .where(eq(routeShipments.routeId, input.id));

      const shipmentIds = allRouteShipments.map(rs => rs.shipmentId);
            const validRouteStatuses = ["RECIBIDO_EN_BODEGA", "EN_RUTA", "EN_PARADA"];
      const shipmentsData = shipmentIds.length > 0
        ? await db.select().from(shipments)
            .where(and(
              inArray(shipments.id, shipmentIds),
              inArray(shipments.status, validRouteStatuses)
            ))
        : [];

      const itemsData = shipmentIds.length > 0
        ? await db.select().from(shipmentItems).where(inArray(shipmentItems.shipmentId, shipmentIds))
        : [];

      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

      const stopsWithShipments = stops.map(stop => {
        const stopShipments = allRouteShipments
          .filter(rs => rs.stopId === stop.id)
          .map(rs => {
            const shipment = shipmentsData.find(s => s.id === rs.shipmentId);
            const items = itemsData.filter(i => i.shipmentId === rs.shipmentId);
            return {
              ...rs,
              shipment: shipment ? {
                ...shipment,
                items,
                originFranchise: franchiseMap.get(shipment.originFranchiseId),
                destinationFranchise: franchiseMap.get(shipment.destinationFranchiseId),
              } : null,
            };
          });

        return {
          ...stop,
          shipments: stopShipments,
          totalShipments: stopShipments.length,
          delivered: stopShipments.filter(s => s.status === "ENTREGADO").length,
          notCollected: stopShipments.filter(s => s.status === "NO_RECOGIDO").length,
          pending: stopShipments.filter(s => s.status === "ASIGNADO").length,
        };
      });

      const totalAssigned = allRouteShipments.length;
      const totalDelivered = allRouteShipments.filter(s => s.status === "ENTREGADO").length;
      const totalNotCollected = allRouteShipments.filter(s => s.status === "NO_RECOGIDO").length;

      return {
        ...route[0],
        stops: stopsWithShipments,
        summary: {
          totalAssigned,
          totalDelivered,
          totalNotCollected,
          totalPending: totalAssigned - totalDelivered - totalNotCollected,
        },
      };
    }),

  assignShipments: franchiseAuthedQuery
    .input(z.object({
      routeId: z.number(),
      stopId: z.number(),
      shipmentIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      for (const shipmentId of input.shipmentIds) {
        await db.insert(routeShipments).values({
          routeId: input.routeId,
          stopId: input.stopId,
          shipmentId,
        }).onDuplicateKeyUpdate({ set: { stopId: input.stopId } });

        await db.insert(shipmentTracking).values({
          shipmentId,
          status: "EN_RUTA",
          locationId: 0,
          notes: "Asignado a ruta de camion",
          createdBy: ctx.franchiseUser!.id,
        });
      }
      return { success: true };
    }),

  removeShipment: franchiseAuthedQuery
    .input(z.object({ routeShipmentId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(routeShipments).where(eq(routeShipments.id, input.routeShipmentId));
      return { success: true };
    }),

  moveShipment: franchiseAuthedQuery
    .input(z.object({
      routeShipmentId: z.number(),
      newStopId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(routeShipments)
        .set({ stopId: input.newStopId })
        .where(eq(routeShipments.id, input.routeShipmentId));
      return { success: true };
    }),

  updateStatus: franchiseAuthedQuery
    .input(z.object({
      id: z.number(),
      status: z.enum(["PLANIFICADA", "EN_RUTA", "COMPLETADA", "CANCELADA"]),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(deliveryRoutes).set({ status: input.status }).where(eq(deliveryRoutes.id, input.id));
      return { success: true };
    }),

  updateStop: franchiseAuthedQuery
    .input(z.object({
      stopId: z.number(),
      status: z.enum(["PENDIENTE", "LLEGADO", "COMPLETADO"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const updateData: Record<string, any> = { status: input.status };
      if (input.status === "LLEGADO") {
        updateData.arrivalTime = new Date();
        const stopData = await db.select().from(routeStops).where(eq(routeStops.id, input.stopId)).limit(1);
        const cityName = stopData[0]?.cityName || "parada";
        const assigned = await db.select().from(routeShipments).where(eq(routeShipments.stopId, input.stopId));
        for (const rs of assigned) {
          await db.insert(shipmentTracking).values({
            shipmentId: rs.shipmentId,
            status: "EN_PARADA",
            locationId: 0,
            notes: `Camion llego a ${cityName} - punto de referencia`,
            createdBy: ctx.franchiseUser!.id,
          });
        }
      } else if (input.status === "COMPLETADO") {
        updateData.departureTime = new Date();
      }
      if (input.notes) updateData.notes = input.notes;

      await db.update(routeStops).set(updateData).where(eq(routeStops.id, input.stopId));
      return { success: true };
    }),

  updateShipmentStatus: franchiseAuthedQuery
    .input(z.object({
      routeShipmentId: z.number(),
      status: z.enum(["ENTREGADO", "NO_RECOGIDO"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const updateData: Record<string, any> = {
        status: input.status,
        deliveredAt: new Date(),
      };
      if (input.notes) updateData.notes = input.notes;

      await db.update(routeShipments).set(updateData).where(eq(routeShipments.id, input.routeShipmentId));

      const rsData = await db.select().from(routeShipments).where(eq(routeShipments.id, input.routeShipmentId)).limit(1);
      if (rsData.length > 0 && input.status === "ENTREGADO") {
        await db.insert(shipmentTracking).values({
          shipmentId: rsData[0].shipmentId,
          status: "RECIBIDO_EN_DESTINO",
          locationId: 0,
          notes: input.notes?.trim() ? `Recibido por el cliente: ${input.notes.trim()}` : "Recibido por el cliente en punto de recogida",
          createdBy: ctx.franchiseUser!.id,
        });
      }

      return { success: true };
    }),

  availableShipments: franchiseAuthedQuery
    .input(z.object({ stopId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();

      let destinationFranchiseId: number | null = null;

      if (input?.stopId) {
        const stop = await db.select().from(routeStops).where(eq(routeStops.id, input.stopId)).limit(1);
        if (stop.length > 0) {
          const allFranchises = await db.select().from(franchises);
          const matchingFranchise = allFranchises.find(f =>
            f.displayName?.toLowerCase().includes(stop[0].cityName.toLowerCase()) ||
            f.name.toLowerCase() === stop[0].cityName.toLowerCase()
          );
          if (matchingFranchise) {
            destinationFranchiseId = matchingFranchise.id;
          }
        }
      }

            // Get all pickup point franchise IDs (displayName contains "recogida")
      const allFranchises = await db.select().from(franchises);
      const pickupFranchises = allFranchises.filter(f =>
        f.displayName?.toLowerCase().includes("recogida")
      );
      const pickupIds = pickupFranchises.map(f => f.id);

      if (pickupIds.length === 0) return [];

      // Get shipments in warehouse
      const allShipments = await db.select().from(shipments)
        .where(eq(shipments.status, "RECIBIDO_EN_BODEGA"));

      if (allShipments.length === 0) return [];

      // Filter: only pickup point destinations
      const pickupShipments = allShipments.filter(s => pickupIds.includes(s.destinationFranchiseId));

      // Further filter by specific stop destination if provided
      const filteredShipments = destinationFranchiseId
        ? pickupShipments.filter(s => s.destinationFranchiseId === destinationFranchiseId)
        : pickupShipments;

      if (allShipments.length === 0) return [];

      const assigned = await db.select({ shipmentId: routeShipments.shipmentId }).from(routeShipments)
        .where(eq(routeShipments.status, "ASIGNADO"));
      const assignedIds = new Set(assigned.map(a => a.shipmentId));

            const available = filteredShipments.filter(s => !assignedIds.has(s.id));
      if (available.length === 0) return [];

      const shipmentIds = available.map(s => s.id);
      const items = await db.select().from(shipmentItems).where(inArray(shipmentItems.shipmentId, shipmentIds));

      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

      return available.map(s => ({
        ...s,
        items: items.filter(i => i.shipmentId === s.id),
        originFranchise: franchiseMap.get(s.originFranchiseId),
        destinationFranchise: franchiseMap.get(s.destinationFranchiseId),
      }));
    }),

  pendingByPickupPoint: franchiseAuthedQuery
    .query(async () => {
      const db = getDb();
      const allFranchises = await db.select().from(franchises);
      const pickupPoints = allFranchises.filter(f => f.displayName?.toLowerCase().includes("recogida"));
      const pickupIds = pickupPoints.map(f => f.id);

      if (pickupIds.length === 0) return [];

      const pending = await db.select().from(shipments)
        .where(and(
          eq(shipments.status, "RECIBIDO_EN_BODEGA"),
          inArray(shipments.destinationFranchiseId, pickupIds)
        ));

      if (pending.length === 0) return [];

      const assigned = await db.select({ shipmentId: routeShipments.shipmentId }).from(routeShipments)
        .where(eq(routeShipments.status, "ASIGNADO"));
      const assignedIds = new Set(assigned.map(a => a.shipmentId));
      const available = pending.filter(s => !assignedIds.has(s.id));

      if (available.length === 0) return [];

      const shipmentIds = available.map(s => s.id);
      const items = await db.select().from(shipmentItems).where(inArray(shipmentItems.shipmentId, shipmentIds));
      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

      const enriched = available.map(s => ({
        ...s,
        items: items.filter(i => i.shipmentId === s.id),
        originFranchise: franchiseMap.get(s.originFranchiseId),
        destinationFranchise: franchiseMap.get(s.destinationFranchiseId),
      }));

      const grouped = pickupIds.map(pickupId => {
        const point = franchiseMap.get(pickupId);
        const shipmentsForPoint = enriched.filter(s => s.destinationFranchiseId === pickupId);
        return {
          pickupId,
          cityName: point?.displayName?.replace("Recogida - ", "") || point?.name || "Desconocido",
          fullDisplayName: point?.displayName || point?.name || "Desconocido",
          shipments: shipmentsForPoint,
          count: shipmentsForPoint.length,
        };
      }).filter(g => g.count > 0);

      return grouped;
    }),
});