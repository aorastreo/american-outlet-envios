import { z } from "zod";
import { eq, and, inArray, asc } from "drizzle-orm";
import { createRouter, franchiseAuthedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { deliveryRoutes, routeStops, routeShipments, shipments, shipmentItems, shipmentTracking, franchises } from "@db/schema";
import { TRPCError } from "@trpc/server";

export const routeRouter = createRouter({
  // ─── Create Route ──────────────────────────────────────────────
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

  // ─── List Routes ───────────────────────────────────────────────
  list: franchiseAuthedQuery
    .input(z.object({
      status: z.enum(["PLANIFICADA", "EN_RUTA", "COMPLETADA", "CANCELADA"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let query = db.select().from(deliveryRoutes).orderBy(deliveryRoutes.createdAt);
      if (input?.status) {
        query = query.where(eq(deliveryRoutes.status, input.status)) as any;
      }
      return await query;
    }),

  // ─── Get Route with Stops and Shipments ────────────────────────
  getById: franchiseAuthedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = getDb();
        const route = await db.select().from(deliveryRoutes).where(eq(deliveryRoutes.id, input.id)).limit(1);
        if (route.length === 0) return null;

        const stops = await db.select().from(routeStops)
          .where(eq(routeStops.routeId, input.id))
          .orderBy(asc(routeStops.stopOrder));

        const allRouteShipments = await db.select().from(routeShipments)
          .where(eq(routeShipments.routeId, input.id));

        const shipmentIds = allRouteShipments.map(rs => rs.shipmentId);

        const shipmentsData = shipmentIds.length > 0
          ? await db.select().from(shipments).where(inArray(shipments.id, shipmentIds))
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
      } catch (error: any) {
        console.error("[route.getById] Error:", error.message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }
    }),

  // ─── Assign Shipments to Stop ──────────────────────────────────
  assignShipments: franchiseAuthedQuery
    .input(z.object({
      routeId: z.number(),
      stopId: z.number(),
      shipmentIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      // Get pickup point franchise IDs
      const allFranchises = await db.select().from(franchises);
      const pickupIds = allFranchises
        .filter(f => f.displayName?.toLowerCase().includes("recogida"))
        .map(f => f.id);

      for (const shipmentId of input.shipmentIds) {
        // Validate: only pickup point shipments can be assigned to routes
        const shipment = await db.select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
        if (shipment.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Envio ${shipmentId} no encontrado` });
        }
        if (!pickupIds.includes(shipment[0].destinationFranchiseId)) {
          const destFranchise = allFranchises.find(f => f.id === shipment[0].destinationFranchiseId);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `El envio ${shipment[0].trackingNumber} va a ${destFranchise?.displayName || "tienda"} - solo envios a puntos de recogida pueden ir en ruta de camion`
          });
        }

        await db.insert(routeShipments).values({
          routeId: input.routeId,
          stopId: input.stopId,
          shipmentId,
        }).onDuplicateKeyUpdate({ set: { stopId: input.stopId } });
        // Track: EN_RUTA
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

  // ─── Remove Shipment from Route ────────────────────────────────
  removeShipment: franchiseAuthedQuery
    .input(z.object({ routeShipmentId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(routeShipments).where(eq(routeShipments.id, input.routeShipmentId));
      return { success: true };
    }),

  // ─── Move Shipment to Different Stop ────────────────────────────
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

  // ─── Update Route Status ───────────────────────────────────────
  updateStatus: franchiseAuthedQuery
    .input(z.object({
      id: z.number(),
      status: z.enum(["PLANIFICADA", "EN_RUTA", "COMPLETADA", "CANCELADA"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.update(deliveryRoutes).set({ status: input.status }).where(eq(deliveryRoutes.id, input.id));

      // When route starts (EN_RUTA), track all assigned shipments as EN_RUTA
      if (input.status === "EN_RUTA") {
        const routeStopsList = await db.select().from(routeStops).where(eq(routeStops.routeId, input.id));
        for (const stop of routeStopsList) {
          const assigned = await db.select().from(routeShipments).where(eq(routeShipments.stopId, stop.id));
          for (const rs of assigned) {
            // Insert EN_RUTA tracking entry
            await db.insert(shipmentTracking).values({
              shipmentId: rs.shipmentId,
              status: "EN_RUTA",
              locationId: 0,
              notes: `Asignado a ruta de camion - en ruta hacia ${stop.cityName}`,
              createdBy: ctx.franchiseUser!.id,
            });
            // Update main shipment status to EN_RUTA
            await db.update(shipments).set({ status: "EN_RUTA" }).where(eq(shipments.id, rs.shipmentId));
          }
        }
      }

      // When route completes (COMPLETADA), mark any remaining ASIGNADO shipments as RECIBIDO_EN_DESTINO
      if (input.status === "COMPLETADA") {
        const allRouteShipments = await db.select().from(routeShipments).where(eq(routeShipments.routeId, input.id));
        for (const rs of allRouteShipments) {
          if (rs.status === "ASIGNADO") {
            await db.update(routeShipments).set({ status: "ENTREGADO" }).where(eq(routeShipments.id, rs.id));
            await db.insert(shipmentTracking).values({
              shipmentId: rs.shipmentId,
              status: "RECIBIDO_EN_DESTINO",
              locationId: 0,
              notes: "Entregado en ruta de camion",
              createdBy: ctx.franchiseUser!.id,
            });
            await db.update(shipments).set({ status: "RECIBIDO_EN_DESTINO" }).where(eq(shipments.id, rs.shipmentId));
          }
          if (rs.status === "NO_RECOGIDO") {
            await db.update(routeShipments).set({ status: "DEVUELTO_A_BODEGA" }).where(eq(routeShipments.id, rs.id));
            await db.insert(shipmentTracking).values({
              shipmentId: rs.shipmentId,
              status: "RECIBIDO_EN_BODEGA",
              locationId: 0,
              notes: "No recogido - devuelto a bodega para siguiente ruta",
              createdBy: ctx.franchiseUser!.id,
            });
            await db.update(shipments).set({ status: "RECIBIDO_EN_BODEGA" }).where(eq(shipments.id, rs.shipmentId));
          }
        }
      }

      return { success: true };
    }),

  // ─── Update Stop Status (LLEGADO / COMPLETADO) ─────────────────
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
        // Track EN_PARADA for all assigned shipments
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
          await db.update(shipments).set({ status: "EN_PARADA" }).where(eq(shipments.id, rs.shipmentId));
        }
      } else if (input.status === "COMPLETADO") {
        updateData.departureTime = new Date();
      }
      if (input.notes) updateData.notes = input.notes;

      await db.update(routeStops).set(updateData).where(eq(routeStops.id, input.stopId));
      return { success: true };
    }),

  // ─── Mark Shipment as Delivered / Not Collected ────────────────
  updateShipmentStatus: franchiseAuthedQuery
    .input(z.object({
      routeShipmentId: z.number(),
      status: z.enum(["ENTREGADO", "NO_RECOGIDO"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = getDb();
        console.log("[updateShipmentStatus] routeShipmentId:", input.routeShipmentId, "status:", input.status);
        
        // Verify routeShipment exists
        const existing = await db.select().from(routeShipments).where(eq(routeShipments.id, input.routeShipmentId)).limit(1);
        console.log("[updateShipmentStatus] existing:", existing);
        
        if (existing.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Route shipment not found" });
        }

        const updateData: Record<string, any> = {
          status: input.status,
          deliveredAt: new Date(),
        };
        if (input.notes) updateData.notes = input.notes;

        await db.update(routeShipments).set(updateData).where(eq(routeShipments.id, input.routeShipmentId));
        console.log("[updateShipmentStatus] routeShipments updated");

        // Get shipmentId for tracking
        const rsData = await db.select().from(routeShipments).where(eq(routeShipments.id, input.routeShipmentId)).limit(1);
        
        if (rsData.length > 0) {
          // Insert tracking history for BOTH statuses
          await db.insert(shipmentTracking).values({
            shipmentId: rsData[0].shipmentId,
            status: input.status === "ENTREGADO" ? "RECIBIDO_EN_DESTINO" : "NO_RECOGIDO",
            locationId: 0,
            notes: input.status === "ENTREGADO"
              ? (input.notes?.trim() ? `Recibido por el cliente: ${input.notes.trim()}` : "Recibido por el cliente en punto de recogida")
              : "Cliente no se presento a recoger el paquete en el punto de recogida",
            createdBy: ctx.franchiseUser!.id,
          });
          console.log("[updateShipmentStatus] tracking inserted:", input.status);
        }
        
        // Update main shipment status
        if (rsData.length > 0) {
          await db.update(shipments)
            .set({ status: input.status === "ENTREGADO" ? "RECIBIDO_EN_DESTINO" : "NO_RECOGIDO" })
            .where(eq(shipments.id, rsData[0].shipmentId));
          console.log("[updateShipmentStatus] shipments updated");
        }

        return { success: true, status: input.status };
      } catch (error: any) {
        console.error("[updateShipmentStatus] ERROR:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message || "Error updating shipment" });
      }
    }),

  // ─── Get Available Shipments (in warehouse, NOT assigned, ONLY pickup points) ──
  availableShipments: franchiseAuthedQuery
    .input(z.object({ stopId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();

      // Get all pickup point franchise IDs: by code, name, or hardcoded IDs
      const allFranchises = await db.select().from(franchises);
      const pickupCodes = ["grecia", "palmares", "san_ramon"];
      const pickupFranchises = allFranchises.filter(f =>
        pickupCodes.includes(f.code?.toLowerCase() || "") ||
        f.displayName?.toLowerCase().includes("recogida") ||
        [5, 6, 7].includes(f.id)
      );
      const pickupIds = pickupFranchises.map(f => f.id);

      if (pickupIds.length === 0) return [];

      let destinationFranchiseId: number | null = null;

      // If stopId provided, filter by that stop's specific destination
      if (input?.stopId) {
        const stop = await db.select().from(routeStops).where(eq(routeStops.id, input.stopId)).limit(1);
        if (stop.length > 0) {
          const matchingFranchise = pickupFranchises.find(f =>
            f.displayName?.toLowerCase().includes(stop[0].cityName.toLowerCase()) ||
            f.name.toLowerCase() === stop[0].cityName.toLowerCase()
          );
          if (matchingFranchise) {
            destinationFranchiseId = matchingFranchise.id;
          }
        }
      }

      // Get shipments in warehouse: desde tiendas (RECIBIDO_EN_BODEGA), desde bodega (CREADO), o no recogidos
      const allShipments = await db.select().from(shipments)
  .where(inArray(shipments.status, ["CREADO", "RECIBIDO_EN_BODEGA", "NO_RECOGIDO"]));

      if (allShipments.length === 0) return [];

      // Filter: only pickup point destinations
      const pickupShipments = allShipments.filter(s => pickupIds.includes(s.destinationFranchiseId));

      // Further filter by specific stop destination if provided
      const filteredShipments = destinationFranchiseId
        ? pickupShipments.filter(s => s.destinationFranchiseId === destinationFranchiseId)
        : pickupShipments;

      if (filteredShipments.length === 0) return [];

      // Exclude already assigned to routes
      const assigned = await db.select({ shipmentId: routeShipments.shipmentId }).from(routeShipments)
        .where(eq(routeShipments.status, "ASIGNADO"));
      const assignedIds = new Set(assigned.map(a => a.shipmentId));

      const available = filteredShipments.filter(s => !assignedIds.has(s.id));
      if (available.length === 0) return [];

      const shipmentIds = available.map(s => s.id);
      const items = await db.select().from(shipmentItems).where(inArray(shipmentItems.shipmentId, shipmentIds));

      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

      return available.map(s => ({
        ...s,
        items: items.filter(i => i.shipmentId === s.id),
        originFranchise: franchiseMap.get(s.originFranchiseId),
        destinationFranchise: franchiseMap.get(s.destinationFranchiseId),
      }));
    }),

  // ─── Get Pending Shipments by Pickup Point ─────────────────────
  pendingByPickupPoint: franchiseAuthedQuery
    .query(async () => {
      const db = getDb();
      const allFranchises = await db.select().from(franchises);
      // Detect pickup points: by code (grecia, palmares, san_ramon), by name (recogida), or by hardcoded IDs
      const pickupCodes = ["grecia", "palmares", "san_ramon"];
      const pickupPoints = allFranchises.filter(f =>
        pickupCodes.includes(f.code?.toLowerCase() || "") ||
        f.displayName?.toLowerCase().includes("recogida") ||
        [5, 6, 7].includes(f.id)
      );
      const pickupIds = pickupPoints.map(f => f.id);

      if (pickupIds.length === 0) return [];

      // Envios a puntos de recogida: desde bodega estan en CREADO, desde tiendas en RECIBIDO_EN_BODEGA
      const pending = await db.select().from(shipments)
        .where(and(
          inArray(shipments.status, ["CREADO", "RECIBIDO_EN_BODEGA"]),
          inArray(shipments.destinationFranchiseId, pickupIds)
        ));

      if (pending.length === 0) return [];

      // Exclude already assigned
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

      // Group by destination
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

  // ─── Repair Tracking for Existing Routes ───────────────────────
  // Automatically creates EN_RUTA tracking entries for shipments in active routes
  repairTracking: franchiseAuthedQuery
    .input(z.object({ routeId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const results: Array<{ shipmentId: number; action: string }> = [];

      // Get the route
      const route = await db.select().from(deliveryRoutes).where(eq(deliveryRoutes.id, input.routeId)).limit(1);
      if (route.length === 0 || route[0].status !== "EN_RUTA") {
        return { fixed: 0, message: "Route not found or not EN_RUTA", details: [] };
      }

      // Get all stops and their shipments
      const stops = await db.select().from(routeStops).where(eq(routeStops.routeId, input.routeId));
      for (const stop of stops) {
        const assigned = await db.select().from(routeShipments).where(eq(routeShipments.stopId, stop.id));
        for (const rs of assigned) {
          // Check if this shipment already has EN_RUTA tracking
          const existingTracking = await db.select().from(shipmentTracking)
            .where(and(
              eq(shipmentTracking.shipmentId, rs.shipmentId),
              eq(shipmentTracking.status, "EN_RUTA")
            ));

          if (existingTracking.length === 0) {
            // Create EN_RUTA tracking entry
            await db.insert(shipmentTracking).values({
              shipmentId: rs.shipmentId,
              status: "EN_RUTA",
              locationId: 0,
              notes: `Asignado a ruta de camion - en ruta hacia ${stop.cityName}`,
              createdBy: ctx.franchiseUser!.id,
            });

            // Update main shipment status to EN_RUTA
            await db.update(shipments).set({ status: "EN_RUTA" }).where(eq(shipments.id, rs.shipmentId));

            results.push({ shipmentId: rs.shipmentId, action: "created_EN_RUTA" });
          }
        }
      }

      return {
        fixed: results.length,
        message: results.length > 0 ? `Creados ${results.length} tracking EN_RUTA` : "Todos los envios ya tienen tracking EN_RUTA",
        details: results,
      };
    }),
  repairEnParada: franchiseAuthedQuery
    .mutation(async ({ ctx }) => {
      const db = getDb();
      const results: { shipmentId: number; action: string }[] = [];

      // Find all route shipments whose stop is LLEGADO or COMPLETADO
      // but shipment status is still EN_RUTA (should be EN_PARADA)
      const allRouteShipments = await db
        .select()
        .from(routeShipments)
        .innerJoin(routeStops, eq(routeShipments.stopId, routeStops.id))
        .where(
          and(
            inArray(routeStops.status, ["LLEGADO", "COMPLETADO"]),
          )
        );

      for (const row of allRouteShipments) {
        const rs = row.route_shipments;
        const stop = row.route_stops;

        // Check if shipment status is still EN_RUTA
        const shipmentData = await db
          .select()
          .from(shipments)
          .where(eq(shipments.id, rs.shipmentId))
          .limit(1);

        if (shipmentData[0]?.status === "EN_RUTA") {
          // Update shipment status to EN_PARADA
          await db.update(shipments)
            .set({ status: "EN_PARADA" })
            .where(eq(shipments.id, rs.shipmentId));

          // Check if EN_PARADA tracking already exists
          const existingTracking = await db
            .select()
            .from(shipmentTracking)
            .where(and(
              eq(shipmentTracking.shipmentId, rs.shipmentId),
              eq(shipmentTracking.status, "EN_PARADA"),
            ));

          if (existingTracking.length === 0) {
            await db.insert(shipmentTracking).values({
              shipmentId: rs.shipmentId,
              status: "EN_PARADA",
              locationId: 0,
              notes: `Camion llego a ${stop.cityName} - punto de recogida (reparacion)`,
              createdBy: ctx.franchiseUser!.id,
            });
          }

          results.push({ shipmentId: rs.shipmentId, action: "updated_to_EN_PARADA" });
        }
      }

      return {
        fixed: results.length,
                message: results.length > 0 ? "Actualizados " + results.length + " envios a EN_PARADA" : "Todos los envios ya tienen el estado correcto",
        details: results,
      };
    }),
});
