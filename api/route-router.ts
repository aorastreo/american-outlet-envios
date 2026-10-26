import { z } from "zod";
import { eq, and, inArray, asc, ne } from "drizzle-orm";
import { createRouter, franchiseAuthedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { deliveryRoutes, routeStops, routeShipments, shipments, shipmentItems, shipmentTracking, franchises } from "@db/schema";
import { TRPCError } from "@trpc/server";

function isPickupFranchise(franchise: { code?: string | null; displayName?: string | null; name?: string | null }) {
  const code = (franchise.code || "").toLowerCase();
  const name = `${franchise.displayName || ""} ${franchise.name || ""}`.toLowerCase();
  return code === "grecia" || code === "palmares" || code === "san_ramon"
    || name.includes("recogida")
    || name.includes("grecia")
    || name.includes("palmares")
    || name.includes("san ramon");
}

function readyForDriverRoute(
  shipment: { status: string; warehouseLocation?: string | null; originFranchiseId?: number | null },
  origin?: { isWarehouse?: number | null } | null,
) {
  if (shipment.status === "NO_RECOGIDO") return true;
  if (shipment.warehouseLocation !== "Bodega Cedi") return false;
  if (shipment.status === "RECIBIDO_EN_BODEGA") return true;
  // A store writes "Bodega Cedi" as the first stop while the box is still at the store.
  return shipment.status === "CREADO" && origin?.isWarehouse === 1;
}

function pickupCity(name: string | null | undefined): string {
  return (name || "").replace(/^Recogida\s*-\s*/i, "").trim();
}

async function bodegaCediId(db: ReturnType<typeof getDb>): Promise<number | null> {
  const rows = await db.select({ id: franchises.id }).from(franchises).where(eq(franchises.code, "bodega_cedi")).limit(1);
  return rows[0]?.id ?? null;
}

function stopIdForDestination(
  stops: { id: number; cityName: string }[],
  destinationName: string,
): number | null {
  const dest = destinationName.toLowerCase();
  const ordered = [...stops].sort((a, b) => b.cityName.length - a.cityName.length);
  for (const stop of ordered) {
    const city = stop.cityName.toLowerCase().trim();
    if (city && dest.includes(city)) return stop.id;
  }
  return null;
}

async function placeShipmentOnStop(
  db: ReturnType<typeof getDb>,
  shipmentId: number,
  routeId: number,
  stopId: number,
) {
  const existing = await db.select().from(routeShipments).where(and(
    eq(routeShipments.shipmentId, shipmentId),
    eq(routeShipments.status, "ASIGNADO"),
  ));
  if (existing.length > 0) {
    await db.update(routeShipments)
      .set({ routeId, stopId })
      .where(eq(routeShipments.id, existing[0].id));
    const extraIds = existing.slice(1).map((row) => row.id);
    if (extraIds.length > 0) {
      await db.delete(routeShipments).where(inArray(routeShipments.id, extraIds));
    }
    return;
  }
  await db.insert(routeShipments).values({ routeId, stopId, shipmentId });
}

export const routeRouter = createRouter({
  // ─── Create Route ──────────────────────────────────────────────
  create: franchiseAuthedQuery
    .input(z.object({
      name: z.string().min(1).max(255),
      stops: z.array(z.object({
        cityName: z.string().min(1).max(100),
      })).min(1),
      shipmentIds: z.array(z.number()).optional(),
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

      const createdStops = await db.select().from(routeStops).where(eq(routeStops.routeId, routeId));
      const shipmentIds = input.shipmentIds || [];
      let assigned = 0;
      const skipped: string[] = [];

      if (shipmentIds.length > 0) {
        const allFranchises = await db.select().from(franchises);
        const pickupIds = allFranchises.filter(isPickupFranchise).map((franchise) => franchise.id);
        for (const shipmentId of shipmentIds) {
          const shipment = await db.select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
          if (shipment.length === 0) {
            skipped.push(String(shipmentId));
            continue;
          }
          const row = shipment[0];
          const destFranchise = allFranchises.find((franchise) => franchise.id === row.destinationFranchiseId);
          const originFranchise = allFranchises.find((franchise) => franchise.id === row.originFranchiseId);
          const destName = destFranchise?.displayName || destFranchise?.name || "";
          const stopId = stopIdForDestination(createdStops, destName);
          if (!pickupIds.includes(row.destinationFranchiseId) || !readyForDriverRoute(row, originFranchise) || !stopId) {
            skipped.push(row.trackingNumber);
            continue;
          }
          await placeShipmentOnStop(db, row.id, routeId, stopId);
          assigned++;
        }
      }

      return { success: true, routeId, assigned, skipped };
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
      const routes = await query;

      // Get shipment counts for each route
      const routeIds = routes.map(r => r.id);
      let shipmentCounts: Record<number, { total: number; entregados: number; noRecogidos: number }> = {};
      if (routeIds.length > 0) {
        const allRouteShipments = await db.select().from(routeShipments).where(inArray(routeShipments.routeId, routeIds));
        for (const rs of allRouteShipments) {
          if (!shipmentCounts[rs.routeId]) {
            shipmentCounts[rs.routeId] = { total: 0, entregados: 0, noRecogidos: 0 };
          }
          shipmentCounts[rs.routeId].total++;
          if (rs.status === "ENTREGADO") shipmentCounts[rs.routeId].entregados++;
          if (rs.status === "NO_RECOGIDO") shipmentCounts[rs.routeId].noRecogidos++;
        }
      }

      return routes.map(r => ({
        ...r,
        summary: shipmentCounts[r.id] || { total: 0, entregados: 0, noRecogidos: 0 },
      }));
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
    .mutation(async ({ input }) => {
      const db = getDb();

      // Get pickup point franchise IDs
      const allFranchises = await db.select().from(franchises);
      const pickupIds = allFranchises.filter(isPickupFranchise).map(f => f.id);

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
        const originFranchise = allFranchises.find((franchise) => franchise.id === shipment[0].originFranchiseId);
        if (!readyForDriverRoute(shipment[0], originFranchise)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `El envio ${shipment[0].trackingNumber} todavia no esta en Bodega Cedi. Primero tiene que llegar ahi.`,
          });
        }

        await placeShipmentOnStop(db, shipmentId, input.routeId, input.stopId);
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
            if (rs.status === "ENTREGADO" || rs.status === "NO_RECOGIDO") continue;
            const current = await db.select().from(shipments).where(eq(shipments.id, rs.shipmentId)).limit(1);
            if (current[0]?.status === "RECIBIDO_EN_DESTINO" || current[0]?.status === "CANCELADO") continue;
            const city = pickupCity(stop.cityName) || stop.cityName;
            await db.insert(shipmentTracking).values({
              shipmentId: rs.shipmentId,
              status: "EN_RUTA",
              locationId: 0,
              notes: `En ruta hacia ${city}`,
              createdBy: ctx.franchiseUser!.id,
            });
            await db.update(shipments).set({ status: "EN_RUTA" }).where(eq(shipments.id, rs.shipmentId));
          }
        }
      }

      // When route completes (COMPLETADA), mark any remaining ASIGNADO shipments as NO_RECOGIDO
      // (if the driver never marked them, they weren't delivered — assume not collected)
      if (input.status === "COMPLETADA") {
        const allRouteShipments = await db.select().from(routeShipments).where(eq(routeShipments.routeId, input.id));
        const stops = await db.select().from(routeStops).where(eq(routeStops.routeId, input.id));
        const cityByStop = new Map(stops.map((stop) => [stop.id, pickupCity(stop.cityName)]));
        const cediId = await bodegaCediId(db);
        for (const rs of allRouteShipments) {
          if (rs.status === "ASIGNADO") {
            const current = await db.select().from(shipments).where(eq(shipments.id, rs.shipmentId)).limit(1);
            if (current[0]?.status === "CANCELADO") {
              await db.delete(routeShipments).where(eq(routeShipments.id, rs.id));
              continue;
            }
            const city = cityByStop.get(rs.stopId) || "";
            await db.update(routeShipments).set({ status: "NO_RECOGIDO" }).where(eq(routeShipments.id, rs.id));
            await db.insert(shipmentTracking).values({
              shipmentId: rs.shipmentId,
              status: "NO_RECOGIDO",
              locationId: 0,
              notes: city ? `No recogido en ${city}` : "No recogido - cliente no paso a retirar el paquete",
              createdBy: ctx.franchiseUser!.id,
            });
            await db.update(shipments).set({
              status: "NO_RECOGIDO",
              ...(cediId ? { currentLocationId: cediId } : {}),
            }).where(eq(shipments.id, rs.shipmentId));
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
        const stopData = await db.select().from(routeStops).where(eq(routeStops.id, input.stopId)).limit(1);
        if (!stopData[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Parada no encontrada" });
        const earlierStops = await db.select().from(routeStops).where(eq(routeStops.routeId, stopData[0].routeId));
        const previousStillOpen = earlierStops.some((stop) => stop.stopOrder < stopData[0].stopOrder && stop.status !== "COMPLETADO");
        if (previousStillOpen) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Primero hay que salir de la parada anterior" });
        }
        const cityName = stopData[0]?.cityName || "parada";
        const assigned = await db.select().from(routeShipments).where(eq(routeShipments.stopId, input.stopId));
        for (const rs of assigned) {
          if (rs.status === "ENTREGADO" || rs.status === "NO_RECOGIDO") continue;
          const current = await db.select().from(shipments).where(eq(shipments.id, rs.shipmentId)).limit(1);
          if (current[0]?.status === "RECIBIDO_EN_DESTINO" || current[0]?.status === "NO_RECOGIDO" || current[0]?.status === "CANCELADO") continue;
          await db.insert(shipmentTracking).values({
            shipmentId: rs.shipmentId,
            status: "EN_PARADA",
            locationId: 0,
            notes: `Camion llego a ${cityName} - punto de referencia`,
            createdBy: ctx.franchiseUser!.id,
          });
          await db.update(shipments).set({
            status: "EN_PARADA",
            ...(current[0]?.destinationFranchiseId ? { currentLocationId: current[0].destinationFranchiseId } : {}),
          }).where(eq(shipments.id, rs.shipmentId));
        }
      } else if (input.status === "COMPLETADO") {
        const leavingStop = await db.select().from(routeStops).where(eq(routeStops.id, input.stopId)).limit(1);
        if (leavingStop[0]?.status === "PENDIENTE") {
          const earlierStops = await db.select().from(routeStops).where(eq(routeStops.routeId, leavingStop[0].routeId));
          const previousStillOpen = earlierStops.some((stop) => stop.stopOrder < leavingStop[0].stopOrder && stop.status !== "COMPLETADO");
          if (previousStillOpen) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Primero hay que salir de la parada anterior" });
          }
        }
        const stillAssigned = await db.select().from(routeShipments).where(and(
          eq(routeShipments.stopId, input.stopId),
          eq(routeShipments.status, "ASIGNADO"),
        ));
        const assignedShipments = stillAssigned.length > 0
          ? await db.select({ id: shipments.id, status: shipments.status }).from(shipments).where(inArray(shipments.id, stillAssigned.map((row) => row.shipmentId)))
          : [];
        const cancelledIds = new Set(assignedShipments.filter((row) => row.status === "CANCELADO").map((row) => row.id));
        if (cancelledIds.size > 0) {
          const cancelledRows = stillAssigned.filter((row) => cancelledIds.has(row.shipmentId)).map((row) => row.id);
          if (cancelledRows.length > 0) {
            await db.delete(routeShipments).where(inArray(routeShipments.id, cancelledRows));
          }
        }
        const blocking = stillAssigned.filter((row) => !cancelledIds.has(row.shipmentId));
        if (blocking.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Marque cada envio como entregado o no recogido antes de salir de la parada.",
          });
        }
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
      status: z.enum(["ENTREGADO", "NO_RECOGIDO", "ASIGNADO"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = getDb();
        console.log("[updateShipmentStatus] routeShipmentId:", input.routeShipmentId, "status:", input.status);

        const existing = await db.select().from(routeShipments).where(eq(routeShipments.id, input.routeShipmentId)).limit(1);
        if (existing.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Route shipment not found" });
        }

        const shipmentBefore = await db.select().from(shipments).where(eq(shipments.id, existing[0].shipmentId)).limit(1);
        if (shipmentBefore[0]?.status === "CANCELADO" && input.status !== "ASIGNADO") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Este envio esta cancelado" });
        }

        if (input.status === "ENTREGADO" || input.status === "NO_RECOGIDO") {
          const stopBeforeMark = existing[0].stopId
            ? await db.select().from(routeStops).where(eq(routeStops.id, existing[0].stopId)).limit(1)
            : [];
          const truckIsHere = stopBeforeMark[0]?.status === "LLEGADO" || stopBeforeMark[0]?.status === "COMPLETADO";
          if (!truckIsHere) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Primero marque que el camion llego a esta parada" });
          }
        }

        // 1. Update route_shipments status
        const routeUpdate: Record<string, any> = {
          status: input.status,
          deliveredAt: input.status === "ASIGNADO" ? null : new Date(),
        };
        if (input.notes) routeUpdate.notes = input.notes;
        await db.update(routeShipments).set(routeUpdate).where(eq(routeShipments.id, input.routeShipmentId));

        // 2. Get shipmentId
        const rsData = await db.select().from(routeShipments).where(eq(routeShipments.id, input.routeShipmentId)).limit(1);
        if (rsData.length === 0) return { success: true, status: input.status };

        const shipmentId = rsData[0].shipmentId;
        const stopRows = rsData[0].stopId
          ? await db.select().from(routeStops).where(eq(routeStops.id, rsData[0].stopId)).limit(1)
          : [];
        const city = pickupCity(stopRows[0]?.cityName);
        const stopIsOpen = stopRows[0]?.status === "LLEGADO" || stopRows[0]?.status === "COMPLETADO";

        // Undoing a mark after the driver already left reopens the stop,
        // so the route cannot close while this package is unmarked again.
        if (input.status === "ASIGNADO" && stopRows[0]?.status === "COMPLETADO") {
          await db.update(routeStops)
            .set({ status: "LLEGADO", departureTime: null })
            .where(eq(routeStops.id, stopRows[0].id));
        }

        // 3. Map route status to shipments.status (valid enum values)
        const shipmentStatus = input.status === "ENTREGADO" ? "RECIBIDO_EN_DESTINO"
          : input.status === "NO_RECOGIDO" ? "NO_RECOGIDO"
          : stopIsOpen ? "EN_PARADA" : "EN_RUTA";

        const shipmentRow = await db.select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
        const placeId = shipmentStatus === "RECIBIDO_EN_DESTINO" || shipmentStatus === "EN_PARADA"
          ? shipmentRow[0]?.destinationFranchiseId
          : await bodegaCediId(db);

        await db.update(shipments)
          .set({
            status: shipmentStatus,
            updatedAt: new Date(),
            ...(placeId ? { currentLocationId: placeId } : {}),
          })
          .where(eq(shipments.id, shipmentId));
        console.log("[updateShipmentStatus] shipments.status updated to:", shipmentStatus);

        // 4. Insert tracking history, including when the driver undoes a mark
        const trackingNotes = input.status === "ENTREGADO"
          ? (city
            ? `Entregado al cliente en ${city}${input.notes?.trim() ? ` - ${input.notes.trim()}` : ""}`
            : (input.notes?.trim() ? `Recibido por el cliente: ${input.notes.trim()}` : "Recibido por el cliente en punto de recogida"))
          : input.status === "NO_RECOGIDO"
            ? (city ? `No recogido en ${city}` : "Cliente no se presento a recoger el paquete en el punto de recogida")
            : shipmentStatus === "EN_PARADA"
              ? (city ? `Camion llego a ${city} - punto de referencia` : "Camion en el punto de recogida")
              : (city ? `En ruta hacia ${city}` : "En ruta hacia el punto de recogida");

        await db.insert(shipmentTracking).values({
          shipmentId,
          status: input.status === "ENTREGADO" ? "RECIBIDO_EN_DESTINO" : input.status === "NO_RECOGIDO" ? "NO_RECOGIDO" : shipmentStatus,
          locationId: 0,
          notes: trackingNotes,
          createdBy: ctx.franchiseUser!.id,
        });
        console.log("[updateShipmentStatus] tracking inserted:", input.status);

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

      const allFranchises = await db.select().from(franchises);
      const pickupFranchises = allFranchises.filter(isPickupFranchise);
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

      const available = filteredShipments.filter((s) => {
        const origin = allFranchises.find((franchise) => franchise.id === s.originFranchiseId);
        return !assignedIds.has(s.id) && readyForDriverRoute(s, origin);
      });
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
      const pickupPoints = allFranchises.filter(isPickupFranchise);
      const pickupIds = pickupPoints.map(f => f.id);

      if (pickupIds.length === 0) return [];

      // Envios pendientes para ruta: desde bodega (CREADO), desde tiendas (RECIBIDO_EN_BODEGA), o no recogidos (NO_RECOGIDO para reenvio)
      const pending = await db.select().from(shipments)
        .where(and(
          inArray(shipments.status, ["CREADO", "RECIBIDO_EN_BODEGA", "NO_RECOGIDO"]),
          inArray(shipments.destinationFranchiseId, pickupIds)
        ));

      if (pending.length === 0) return [];

      // Exclude already assigned
      const assigned = await db.select({ shipmentId: routeShipments.shipmentId }).from(routeShipments)
        .where(eq(routeShipments.status, "ASIGNADO"));
      const assignedIds = new Set(assigned.map(a => a.shipmentId));
      const available = pending.filter((s) => {
        const origin = allFranchises.find((franchise) => franchise.id === s.originFranchiseId);
        return !assignedIds.has(s.id) && readyForDriverRoute(s, origin);
      });

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
          if (rs.status === "ENTREGADO" || rs.status === "NO_RECOGIDO") continue;
          const current = await db.select().from(shipments).where(eq(shipments.id, rs.shipmentId)).limit(1);
          const status = current[0]?.status;
          if (!status || status === "RECIBIDO_EN_DESTINO" || status === "NO_RECOGIDO" || status === "EN_PARADA" || status === "CANCELADO") continue;

          const existingTracking = await db.select().from(shipmentTracking)
            .where(and(
              eq(shipmentTracking.shipmentId, rs.shipmentId),
              eq(shipmentTracking.status, "EN_RUTA")
            ));

          if (existingTracking.length === 0) {
            const city = pickupCity(stop.cityName) || stop.cityName;
            await db.insert(shipmentTracking).values({
              shipmentId: rs.shipmentId,
              status: "EN_RUTA",
              locationId: 0,
              notes: `En ruta hacia ${city}`,
              createdBy: ctx.franchiseUser!.id,
            });

            if (status !== "EN_RUTA") {
              await db.update(shipments).set({ status: "EN_RUTA" }).where(eq(shipments.id, rs.shipmentId));
            }

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

  // ─── Get All Route Shipments (for route management page) ──────
  // Returns ALL shipments going to pickup points (Grecia, Palmares, San Ramon)
  // with items and franchise info, grouped by status for the frontend tabs
  getRouteShipments: franchiseAuthedQuery
    .query(async () => {
      const db = getDb();

      const allFranchises = await db.select().from(franchises);
      const pickupFranchises = allFranchises.filter(isPickupFranchise);
      const pickupIds = pickupFranchises.map(f => f.id);

      if (pickupIds.length === 0) return [];

      const openRouteRows = await db
        .select({ shipmentId: routeShipments.shipmentId, status: routeShipments.status })
        .from(routeShipments)
        .innerJoin(deliveryRoutes, eq(deliveryRoutes.id, routeShipments.routeId))
        .where(inArray(deliveryRoutes.status, ["PLANIFICADA", "EN_RUTA"]));
      const reservedIds = new Set(
        openRouteRows.filter((row) => row.status === "ASIGNADO").map((row) => row.shipmentId)
      );
      const onOpenRoute = new Set(openRouteRows.map((row) => row.shipmentId));

      const stuckRows = await db
        .select({ shipmentId: shipments.id })
        .from(routeShipments)
        .innerJoin(deliveryRoutes, eq(deliveryRoutes.id, routeShipments.routeId))
        .innerJoin(shipments, eq(shipments.id, routeShipments.shipmentId))
        .where(and(
          eq(deliveryRoutes.status, "COMPLETADA"),
          eq(shipments.status, "EN_PARADA"),
          ne(routeShipments.status, "ENTREGADO"),
        ));
      const stuckIds = new Set(
        stuckRows.map((row) => row.shipmentId).filter((id) => !onOpenRoute.has(id))
      );

      // Get all route shipments (any status, from any origin)
      const pickupShipments = await db.select().from(shipments)
        .where(inArray(shipments.destinationFranchiseId, pickupIds))
        .orderBy(shipments.createdAt);

      if (pickupShipments.length === 0) return [];

      // Get items
      const shipmentIds = pickupShipments.map(s => s.id);
      const items = await db.select().from(shipmentItems)
        .where(inArray(shipmentItems.shipmentId, shipmentIds));

      // Build franchise map
      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

      return pickupShipments.map(s => ({
        ...s,
        items: items.filter(i => i.shipmentId === s.id),
        originFranchise: franchiseMap.get(s.originFranchiseId),
        destinationFranchise: franchiseMap.get(s.destinationFranchiseId),
        reservedOnRoute: reservedIds.has(s.id),
        stuckAfterRoute: stuckIds.has(s.id),
      }));
    }),

  // ─── Fix Stuck EN_PARADA Shipments ─────────────────────────────
  // Finds shipments stuck in EN_PARADA whose route is already COMPLETADA
  // and marks them as NO_RECOGIDO so they appear in the "No Recogidos" tab
  fixStuckEnParada: franchiseAuthedQuery
    .mutation(async ({ ctx }) => {
      const db = getDb();

      // Get all completed routes
      const completedRoutes = await db.select().from(deliveryRoutes)
        .where(eq(deliveryRoutes.status, "COMPLETADA"));

      if (completedRoutes.length === 0) return { fixed: 0, message: "No rutas completadas" };

      const cediId = await bodegaCediId(db);
      const openRouteRows = await db
        .select({ shipmentId: routeShipments.shipmentId })
        .from(routeShipments)
        .innerJoin(deliveryRoutes, eq(deliveryRoutes.id, routeShipments.routeId))
        .where(inArray(deliveryRoutes.status, ["PLANIFICADA", "EN_RUTA"]));
      const onOpenRoute = new Set(openRouteRows.map((row) => row.shipmentId));
      let fixed = 0;
      for (const route of completedRoutes) {
        // Get route shipments for this route
        const rsList = await db.select().from(routeShipments)
          .where(eq(routeShipments.routeId, route.id));
        const stops = await db.select().from(routeStops).where(eq(routeStops.routeId, route.id));
        const cityByStop = new Map(stops.map((stop) => [stop.id, pickupCity(stop.cityName)]));

        for (const rs of rsList) {
          if (rs.status === "ENTREGADO" || onOpenRoute.has(rs.shipmentId)) continue;
          // Check if shipment is still stuck in EN_PARADA
          const shipmentData = await db.select().from(shipments)
            .where(eq(shipments.id, rs.shipmentId))
            .limit(1);

          if (shipmentData[0]?.status === "EN_PARADA") {
            // Mark as NO_RECOGIDO
            await db.update(routeShipments)
              .set({ status: "NO_RECOGIDO" })
              .where(eq(routeShipments.id, rs.id));

            await db.insert(shipmentTracking).values({
              shipmentId: rs.shipmentId,
              status: "NO_RECOGIDO",
              locationId: 0,
              notes: cityByStop.get(rs.stopId) ? `No recogido en ${cityByStop.get(rs.stopId)}` : "No recogido - ruta completada, cliente no paso a retirar",
              createdBy: ctx.franchiseUser!.id,
            });

            await db.update(shipments)
              .set({
                status: "NO_RECOGIDO",
                ...(cediId ? { currentLocationId: cediId } : {}),
              })
              .where(eq(shipments.id, rs.shipmentId));

            fixed++;
          }
        }
      }

      return {
        fixed,
        message: fixed > 0
          ? `Corregidos ${fixed} envio${fixed === 1 ? "" : "s"}. Quedaron como no recogidos y ya se pueden asignar a otra ruta.`
          : "No hay envios atascados",
      };
    }),
});
