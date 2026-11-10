import { z } from "zod";
import { eq, or, and, desc, sql, inArray, ne } from "drizzle-orm";
import { createRouter, publicQuery, franchiseAuthedQuery } from "./middleware";
import { getFranchiseGroup, isRetiredFranchise, needsInterBodega } from "../src/lib/franchise-groups";
import { getDb } from "./queries/connection";
import {
  shipments,
  shipmentItems,
  shipmentMarks,
  shipmentTrips,
  shipmentTracking,
  franchises,
  franchiseUsers,
  routeShipments,
  deliveryRoutes,
} from "@db/schema";
import { TRPCError } from "@trpc/server";
import {
  assertHubWarehouseOperator,
  assertShipmentAtWarehouse,
  isDriverUsername,
  warehouseLocationOf,
} from "./lib/auth-guards";

const markTabSchema = z.enum(["POR_ENVIAR", "POR_RECIBIR", "EN_BODEGA", "EN_TIENDA"]);
let shipmentMarksReady = false;

async function ensureShipmentMarks(db: ReturnType<typeof getDb>) {
  if (shipmentMarksReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS shipment_marks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      franchiseId INT NOT NULL,
      tab VARCHAR(30) NOT NULL,
      shipmentId INT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY marks_franchise_tab_shipment (franchiseId, tab, shipmentId)
    )
  `);
  shipmentMarksReady = true;
}

async function clearShipmentMarks(db: ReturnType<typeof getDb>, ids: number[]) {
  if (ids.length === 0) return;
  await ensureShipmentMarks(db);
  // Any mark for these packages is stale once their status moves on.
  await db.delete(shipmentMarks).where(inArray(shipmentMarks.shipmentId, ids));
}

function markStatusesForTab(
  tab: z.infer<typeof markTabSchema>,
  isWarehouse: boolean,
  isSabana: boolean,
): string[] {
  if (tab === "POR_ENVIAR") return ["CREADO"];
  if (tab === "POR_RECIBIR") {
    if (isWarehouse && !isSabana) return ["ENVIADO_A_BODEGA"];
    return ["ENVIADO_A_DESTINO"];
  }
  if (tab === "EN_BODEGA") return ["CREADO", "RECIBIDO_EN_BODEGA"];
  return ["RECIBIDO_EN_DESTINO"];
}

let shipmentTripsReady = false;

async function ensureShipmentTrips(db: ReturnType<typeof getDb>) {
  if (shipmentTripsReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS shipment_trips (
      id INT AUTO_INCREMENT PRIMARY KEY,
      franchiseId INT NOT NULL,
      label VARCHAR(120) NOT NULL,
      shipmentIds TEXT NOT NULL,
      packageCount INT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY trips_franchise_created (franchiseId, createdAt)
    )
  `);
  shipmentTripsReady = true;
}

async function keepShipmentTrip(db: ReturnType<typeof getDb>, franchiseId: number, label: string, ids: number[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  await ensureShipmentTrips(db);
  await db.insert(shipmentTrips).values({
    franchiseId,
    label,
    shipmentIds: unique.join(","),
    packageCount: unique.length,
  });
  await clearShipmentMarks(db, unique);
}

function isSabanaWarehouse(franchise: { name?: string | null; code?: string | null; displayName?: string | null } | undefined) {
  const text = `${franchise?.code || ""} ${franchise?.name || ""} ${franchise?.displayName || ""}`.toLowerCase();
  return text.includes("sabana");
}

async function leftOnClosedRoute(
  db: ReturnType<typeof getDb>,
  shipmentId: number,
  status: string,
): Promise<boolean> {
  if (status !== "EN_PARADA") return false;
  const openRoute = await db
    .select({ id: routeShipments.id })
    .from(routeShipments)
    .innerJoin(deliveryRoutes, eq(deliveryRoutes.id, routeShipments.routeId))
    .where(and(
      eq(routeShipments.shipmentId, shipmentId),
      inArray(deliveryRoutes.status, ["PLANIFICADA", "EN_RUTA"]),
    ))
    .limit(1);
  if (openRoute.length > 0) return false;
  const closed = await db
    .select({ id: routeShipments.id })
    .from(routeShipments)
    .innerJoin(deliveryRoutes, eq(deliveryRoutes.id, routeShipments.routeId))
    .where(and(
      eq(routeShipments.shipmentId, shipmentId),
      eq(deliveryRoutes.status, "COMPLETADA"),
      ne(routeShipments.status, "ENTREGADO"),
    ))
    .limit(1);
  return closed.length > 0;
}

// API router loaded

// Helper: replicate frontend's extractBodegaNames logic
function extractBodegaNamesBackend(trackingHistory: any[]) {
  let firstBodega = "";
  let secondBodega = "";
  for (const t of trackingHistory) {
    if (t.status === "RECIBIDO_EN_BODEGA" && !firstBodega && t.notes) {
      const match = t.notes.match(/Recibido en (Bodega\s+\w+)/i);
      if (match) firstBodega = match[1];
    }
    if (t.status === "ENVIADO_A_BODEGA" && !firstBodega && t.notes) {
      const match = t.notes.match(/desde\s+(Bodega\s+\w+)/i);
      if (match) firstBodega = match[1];
    }
    if (t.status === "ENVIADO_A_BODEGA" && firstBodega && t.notes) {
      const match = t.notes.match(/hacia\s+(Bodega\s+\w+)/i);
      if (match && match[1] !== firstBodega) secondBodega = match[1];
    }
  }
  return { firstBodega, secondBodega };
}

// Helper: build timeline steps for public tracking
function buildTimelineSteps(
  isPickup: boolean,
  originIsWarehouse: boolean,
  destIsWarehouse: boolean,
  originName?: string,
  destName?: string
) {
  const originNameClean = (originName || "").toLowerCase().replace("bodega ", "").trim();
  const destNameClean = (destName || "").toLowerCase().replace("bodega ", "").trim();
  const destNameLower = (destName || "").toLowerCase();
  const originNameLower = (originName || "").toLowerCase();

  const originIsCedi = originNameLower.includes("cedi");
  const originIsPavon = originNameLower.includes("pavon");
  const destIsMio = !destNameLower.includes("ganga") && (destNameLower.includes("chiles") || destNameLower.includes("pavon") || destNameLower.includes("santa rosa"));
  const destIsVendedor = destNameLower.includes("boca arenal") || destNameLower.includes("florencia") || destNameLower.includes("fortuna") || destNameLower.includes("quesada") || destNameLower.includes("puerto viejo");
  const destIsSabana = destNameLower.includes("sabana");

  const steps: { status: string; label: string; desc: string }[] = [];

  if (originIsWarehouse && destIsWarehouse) {
    // Bodega -> Bodega
    const isSameBodega = originNameClean === destNameClean && originNameClean !== "";
    const originIsCediClean = originNameClean.includes("cedi");
    const destIsCediClean = destNameClean.includes("cedi");
    steps.push({ status: "CREADO", label: "Creado", desc: originName ? `En ${originName}` : "Envio registrado" });
    if (destIsSabana && !isSameBodega) {
      if (!originIsCediClean) {
        steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a CEDI", desc: "Bodega envia a bodega" });
        steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En CEDI", desc: "Bodega recibio" });
      }
      steps.push({ status: "ENVIADO_A_DESTINO", label: "En camino a Bodega Sabana", desc: "Va hacia Bodega Sabana" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "En Bodega Sabana", desc: "Sabana recibio el paquete" });
    } else if (isSameBodega) {
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${originName || "Bodega"}`, desc: "Listo para retiro en bodega" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "Entregado al cliente", desc: "El cliente recogio el paquete en bodega" });
    } else if (originIsCediClean || destIsCediClean) {
      const destBodega = destName || "Bodega Destino";
      steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${destBodega}`, desc: "Bodega envia a bodega destino" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${destBodega}`, desc: "Listo para retiro en bodega" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "Entregado al cliente", desc: `El cliente recogio el paquete en ${destBodega}` });
    } else {
      steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a Cedi", desc: "Bodega envia a bodega" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En Cedi", desc: "Bodega recibio" });
      const destBodega = destName || "Bodega Destino";
      steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${destBodega}`, desc: "Bodega envia a bodega destino" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${destBodega}`, desc: "Listo para retiro en bodega" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "Entregado al cliente", desc: `El cliente recogio el paquete en ${destBodega}` });
    }
  } else if (destIsWarehouse) {
    // Tienda -> Bodega
    const originIsMioStore = !originNameLower.includes("ganga") && (originNameLower.includes("chiles") || originNameLower.includes("pavon") || originNameLower.includes("santa rosa"));
    const originIsVendedorStore = originNameLower.includes("boca arenal") || originNameLower.includes("florencia") || originNameLower.includes("fortuna") || originNameLower.includes("quesada") || originNameLower.includes("puerto viejo");
    const firstBodegaName = originIsMioStore ? "Bodega Pavon" : originIsVendedorStore ? "CEDI" : "Bodega";
    const destBodegaName = destName || (destNameLower.includes("cedi") ? "CEDI" : destNameLower.includes("pavon") ? "Bodega Pavon" : destIsSabana ? "Bodega Sabana" : "Bodega");

    steps.push({ status: "CREADO", label: "Creado", desc: "Envio registrado" });
    steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${firstBodegaName}`, desc: "Tienda envia a bodega" });
    steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${firstBodegaName}`, desc: "Bodega recibio" });

    const sameWarehouse = firstBodegaName.toLowerCase().replace("bodega ", "").trim() === destBodegaName.toLowerCase().replace("bodega ", "").trim();
    if (destIsSabana) {
      const firstIsCedi = firstBodegaName.toLowerCase().includes("cedi");
      if (!firstIsCedi) {
        steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a CEDI", desc: "Bodega envia a bodega" });
        steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En CEDI", desc: "Bodega recibio" });
      }
      steps.push({ status: "ENVIADO_A_DESTINO", label: "En camino a Bodega Sabana", desc: "Va hacia Bodega Sabana" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "En Bodega Sabana", desc: "Sabana recibio el paquete" });
    } else if (!sameWarehouse) {
      steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${destBodegaName}`, desc: "Bodega envia a bodega destino" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${destBodegaName}`, desc: "Listo para retiro en bodega" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "Entregado al cliente", desc: `El cliente recogio el paquete en ${destBodegaName}` });
    } else {
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "Entregado al cliente", desc: `El cliente recogio el paquete en ${destBodegaName}` });
    }
  } else if (originIsWarehouse) {
    // Bodega -> Tienda
    steps.push({ status: "CREADO", label: "Creado", desc: originName ? `En ${originName}` : "Envio registrado" });
    if (originIsCedi && destIsMio) {
      steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a Bodega Pavon", desc: "Enviado a bodega" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En Bodega Pavon", desc: "Bodega recibio" });
    } else if (originIsPavon && destIsVendedor) {
      steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a CEDI", desc: "Enviado a bodega" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En CEDI", desc: "Bodega recibio" });
    }
    if (isPickup) {
      const city = (destName || "").replace(/AMERICAN OUTLET\s*/i, "").replace(/^Recogida\s*-\s*/i, "").trim();
      steps.push({ status: "EN_RUTA", label: city ? `En ruta a ${city}` : "En ruta", desc: "El camion va hacia el punto" });
      steps.push({ status: "EN_PARADA", label: city ? `En el punto de ${city}` : "En parada", desc: "El camion ya llego" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: city ? `Entregado en ${city}` : "Entregado", desc: "El cliente recogio el paquete" });
    } else {
      steps.push({ status: "ENVIADO_A_DESTINO", label: "Enviado a Destino", desc: destName ? `Enviado a ${destName}` : "Enviado a tienda" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "En tienda", desc: destName ? `${destName} recibio` : "Tienda recibio" });
      steps.push({ status: "ENTREGADO_AL_CLIENTE", label: "Entregado al cliente", desc: "El cliente retiro el paquete" });
    }
  } else if (isPickup) {
    // Tienda -> Ruta
    const originIsMioStore = !originNameLower.includes("ganga") && (originNameLower.includes("chiles") || originNameLower.includes("pavon") || originNameLower.includes("santa rosa"));
    const originIsVendedorStore = originNameLower.includes("boca arenal") || originNameLower.includes("florencia") || originNameLower.includes("fortuna") || originNameLower.includes("quesada") || originNameLower.includes("puerto viejo");
    const firstBodegaName = originIsMioStore ? "Bodega Pavon" : originIsVendedorStore ? "CEDI" : "Bodega";

    steps.push({ status: "CREADO", label: "Creado", desc: "Envio registrado" });
    steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${firstBodegaName}`, desc: "Tienda envia a bodega" });
    steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${firstBodegaName}`, desc: "Bodega recibio" });
    if (originIsMioStore) {
      steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a CEDI", desc: "Bodega envia a bodega" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En CEDI", desc: "Bodega recibio" });
    }
    const city = (destName || "").replace(/AMERICAN OUTLET\s*/i, "").replace(/^Recogida\s*-\s*/i, "").trim();
    steps.push({ status: "EN_RUTA", label: city ? `En ruta a ${city}` : "En ruta", desc: "El camion va hacia el punto" });
    steps.push({ status: "EN_PARADA", label: city ? `En el punto de ${city}` : "En parada", desc: "El camion ya llego" });
    steps.push({ status: "RECIBIDO_EN_DESTINO", label: city ? `Entregado en ${city}` : "Entregado", desc: "El cliente recogio el paquete" });
  } else {
    // Tienda -> Tienda
    const originIsMio = !originNameLower.includes("ganga") && (originNameLower.includes("chiles") || originNameLower.includes("pavon") || originNameLower.includes("santa rosa"));
    const originIsVendedor = originNameLower.includes("boca arenal") || originNameLower.includes("florencia") || originNameLower.includes("fortuna") || originNameLower.includes("quesada") || originNameLower.includes("puerto viejo");
    const isCrossGroup = (originIsMio && destIsVendedor) || (originIsVendedor && destIsMio);
    const firstBodegaName = originIsMio ? "Bodega Pavon" : originIsVendedor ? "CEDI" : "Bodega";

    steps.push({ status: "CREADO", label: "Creado", desc: "Envio registrado" });
    steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${firstBodegaName}`, desc: "Tienda envia a bodega" });
    steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${firstBodegaName}`, desc: "Bodega recibio" });

    if (isCrossGroup) {
      const interBodega = originIsMio ? "CEDI" : "Bodega Pavon";
      steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${interBodega}`, desc: "Bodega envia a bodega" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${interBodega}`, desc: "Bodega recibio" });
    }

    steps.push({ status: "ENVIADO_A_DESTINO", label: "Enviado a Destino", desc: "Bodega envia a tienda" });
    steps.push({ status: "RECIBIDO_EN_DESTINO", label: "En tienda", desc: "Tienda recibio" });
    steps.push({ status: "ENTREGADO_AL_CLIENTE", label: "Entregado al cliente", desc: "El cliente retiro el paquete" });
  }

  return steps;
}

// Helper: limpiar nombres de franquicia
function cleanFranchiseName(name: string | null | undefined): string {
  if (!name) return "Tienda";
  return name.replace(/AMERICAN OUTLET\s*/i, "").trim() || name;
}

function franchiseRouteName(franchise: { displayName?: string | null; name?: string | null } | undefined): string {
  return franchise?.displayName || franchise?.name || "";
}

function canonicalBodega(target: string): "Bodega Cedi" | "Bodega Pavon" {
  return target.toLowerCase().includes("cedi") ? "Bodega Cedi" : "Bodega Pavon";
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
// - "Bodega Pavon" for shipments from/to: Los Chiles, Pavon, Santa Rosa
// - "Bodega Cedi" for shipments from/to: Boca Arenal, Florencia, Fortuna, Ciudad Quesada, Puerto Viejo
// - Cross-group: starts at origin's warehouse, then transfers to destination's warehouse
function getTargetBodega(originName?: string | null, destName?: string | null): { firstBodega: string; finalBodega: string; needsInterBodega: boolean } {
  const MY_STORES = ["los chiles", "pavon", "santa rosa"];
  const VENDOR_STORES = ["boca arenal", "florencia", "fortuna", "ciudad quesada", "puerto viejo"];

  const originLower = (originName || "").toLowerCase();
  const destLower = (destName || "").toLowerCase();

  // Sabana and route pickups (Grecia, Palmares, San Ramon) are associated with the vendor group (Cedi)
  const destIsSabana = destLower.includes("sabana");
  const destIsRoute = ["grecia", "palmares", "san ramon"].some(city => destLower.includes(city));

  // Bodega origins/destinations
  const originIsBodegaPavon = originLower.includes("pavon") && originLower.includes("bodega");
  const originIsBodegaCedi = originLower.includes("cedi") && originLower.includes("bodega");
  const destIsBodegaPavon = destLower.includes("pavon") && destLower.includes("bodega");
  const destIsBodegaCedi = destLower.includes("cedi") && destLower.includes("bodega");

  const originIsMineStore = !originLower.includes("ganga") && MY_STORES.some(s => originLower.includes(s));
  const originIsVendorStore = VENDOR_STORES.some(s => originLower.includes(s));
  const destIsMineStore = !destLower.includes("ganga") && MY_STORES.some(s => destLower.includes(s)) && !destIsSabana && !destIsRoute;
  const destIsVendorStore = VENDOR_STORES.some(s => destLower.includes(s)) || destIsSabana || destIsRoute;

  // Determine group (store or bodega)
  const originIsMine = originIsMineStore || originIsBodegaPavon;
  const originIsVendor = originIsVendorStore || originIsBodegaCedi;
  const destIsMine = destIsMineStore || destIsBodegaPavon;
  const destIsVendor = destIsVendorStore || destIsBodegaCedi || destIsSabana || destIsRoute;

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
      if (!destFranchise[0] || isRetiredFranchise(destFranchise[0])) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esa tienda ya no recibe envios." });
      }
      const destName = destFranchise[0]?.name || "";
      const originName = userFranchise[0]?.name || "";

      // Determine target bodega
      const { firstBodega } = getTargetBodega(originName, destName);

      // Check if this is a pickup route (destination is Grecia, SanRamon, Palmares)
      // Pickup routes are truck destinations (Grecia, Palmares, San Ramon)
      const pickupCodes = ["grecia", "san_ramon", "palmares"];
      const isPickup = pickupCodes.includes(destFranchise[0]?.code?.toLowerCase() || "");
      // All shipments start as CREADO regardless of origin
      const initialStatus = "CREADO";
      const trackingNotes = originIsWarehouse
        ? `Envio creado en ${originName} - Destino: ${destName}`
        : "Envio creado";

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

  // ─── List Shipments ────────────────────────────────────────────
  // The panel asks for every shipment of this store or warehouse.
  // A page size is only applied when a caller asks for one.
  list: franchiseAuthedQuery
    .input(
      z.object({
        page: z.number().min(1).optional(),
        limit: z.number().min(1).max(500).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const pageSize = input?.limit;
      const offset = pageSize ? ((input?.page || 1) - 1) * pageSize : 0;

      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      const isWarehouse = userFranchise[0]?.isWarehouse === 1;

      let whereClause;
      // A store package stays on the store's list until they send it.
      const leftTheStore = or(ne(shipments.status, "CREADO"), eq(shipments.originFranchiseId, franchiseId));

      if (isWarehouse && isSabanaWarehouse(userFranchise[0])) {
        whereClause = and(
          or(
            eq(shipments.destinationFranchiseId, franchiseId),
            eq(shipments.currentLocationId, franchiseId),
          ),
          leftTheStore,
        );
      } else if (isWarehouse) {
        // WAREHOUSE USER: only see shipments assigned to this warehouse
        const myBodegaName = userFranchise[0]?.name || "";
        const isCedi = myBodegaName.toLowerCase().includes("cedi");
        const normalizedName = isCedi ? "Bodega Cedi" : "Bodega Pavon";
        const atThisWarehouse = isCedi
          ? eq(shipments.warehouseLocation, normalizedName)
          : or(eq(shipments.warehouseLocation, normalizedName), sql`${shipments.warehouseLocation} IS NULL`);
        whereClause = and(atThisWarehouse, leftTheStore);
      } else {
        // STORE USER: own packages, plus packages already sent toward this store.
        // Another store's unsent package stays on that store's list.
        whereClause = or(
          eq(shipments.originFranchiseId, franchiseId),
          and(eq(shipments.destinationFranchiseId, franchiseId), ne(shipments.status, "CREADO")),
          eq(shipments.currentLocationId, franchiseId),
        );
      }

      const rowsQuery = db
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
        .orderBy(desc(shipments.createdAt));
      const listedHere = pageSize
        ? await rowsQuery.limit(pageSize).offset(offset)
        : await rowsQuery;

      // A package that left for the other warehouse stays on Entregados after the store receives it.
      let deliveredAfterLeaving: typeof listedHere = [];
      if (isWarehouse && !isSabanaWarehouse(userFranchise[0]) && !pageSize) {
        const myBodegaName = userFranchise[0]?.name || "";
        const normalizedName = myBodegaName.toLowerCase().includes("cedi") ? "Bodega Cedi" : "Bodega Pavon";
        const touchedHere = db
          .select({ id: shipmentTracking.shipmentId })
          .from(shipmentTracking)
          .where(or(
            and(
              eq(shipmentTracking.status, "RECIBIDO_EN_BODEGA"),
              sql`${shipmentTracking.notes} LIKE ${"%Recibido en " + normalizedName + "%"}`,
            ),
            sql`${shipmentTracking.notes} LIKE ${"%desde " + normalizedName + "%"}`,
          ));
        deliveredAfterLeaving = await db
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
          .where(and(
            eq(shipments.status, "RECIBIDO_EN_DESTINO"),
            sql`${shipments.warehouseLocation} != ${normalizedName}`,
            or(inArray(shipments.id, touchedHere), eq(shipments.originFranchiseId, franchiseId)),
          ))
          .orderBy(desc(shipments.createdAt));
      }

      const seenIds = new Set(listedHere.map((row) => row.id));
      const result = [
        ...listedHere,
        ...deliveredAfterLeaving.filter((row) => !seenIds.has(row.id)),
      ];

      // Limpia nombres de franquicia
      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map(f => [f.id, { ...f, displayName: cleanFranchiseName(f.displayName) }]));

      const reservedRows = result.length === 0 ? [] : await db
        .select({ shipmentId: routeShipments.shipmentId })
        .from(routeShipments)
        .innerJoin(deliveryRoutes, eq(deliveryRoutes.id, routeShipments.routeId))
        .where(and(
          inArray(routeShipments.shipmentId, result.map((s) => s.id)),
          eq(routeShipments.status, "ASIGNADO"),
          inArray(deliveryRoutes.status, ["PLANIFICADA", "EN_RUTA"]),
        ));
      const reservedIds = new Set(reservedRows.map((row) => row.shipmentId));

      const paradaIds = result.filter((s) => s.status === "EN_PARADA").map((s) => s.id);
      const stuckIds = new Set<number>();
      if (paradaIds.length > 0) {
        const openRows = await db
          .select({ shipmentId: routeShipments.shipmentId })
          .from(routeShipments)
          .innerJoin(deliveryRoutes, eq(deliveryRoutes.id, routeShipments.routeId))
          .where(and(
            inArray(routeShipments.shipmentId, paradaIds),
            inArray(deliveryRoutes.status, ["PLANIFICADA", "EN_RUTA"]),
          ));
        const onOpenRoute = new Set(openRows.map((row) => row.shipmentId));
        const closedRows = await db
          .select({ shipmentId: routeShipments.shipmentId })
          .from(routeShipments)
          .innerJoin(deliveryRoutes, eq(deliveryRoutes.id, routeShipments.routeId))
          .where(and(
            inArray(routeShipments.shipmentId, paradaIds),
            eq(deliveryRoutes.status, "COMPLETADA"),
            ne(routeShipments.status, "ENTREGADO"),
          ));
        for (const row of closedRows) {
          if (!onOpenRoute.has(row.shipmentId)) stuckIds.add(row.shipmentId);
        }
      }

      const itemRows = result.length === 0 ? [] : await db
        .select({
          shipmentId: shipmentItems.shipmentId,
          description: shipmentItems.description,
          quantity: shipmentItems.quantity,
          details: shipmentItems.details,
        })
        .from(shipmentItems)
        .where(inArray(shipmentItems.shipmentId, result.map((s) => s.id)));
      const itemsByShipment = new Map<number, { description: string; quantity: number; details: string | null }[]>();
      for (const item of itemRows) {
        const list = itemsByShipment.get(item.shipmentId) || [];
        list.push({ description: item.description, quantity: item.quantity, details: item.details });
        itemsByShipment.set(item.shipmentId, list);
      }

      return result.map(s => ({
        ...s,
        originName: cleanFranchiseName(franchiseMap.get(s.originFranchiseId)?.displayName || s.originName),
        destinationName: cleanFranchiseName(franchiseMap.get(s.destinationFranchiseId)?.displayName || s.destinationName),
        currentLocationName: cleanFranchiseName(franchiseMap.get(s.currentLocationId)?.displayName || s.currentLocationName),
        reservedOnRoute: reservedIds.has(s.id),
        stuckAfterRoute: stuckIds.has(s.id),
        items: itemsByShipment.get(s.id) || [],
      }));
    }),

  // ─── List Sent Shipments (envíos que salieron de esta bodega) ──
  listSent: franchiseAuthedQuery
    .input(z.object({
      status: z.string().optional(),
      origin: z.string().optional(),
      destination: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      const isWarehouse = userFranchise[0]?.isWarehouse === 1;

      // Only warehouse users can see sent shipments
      if (!isWarehouse || isSabanaWarehouse(userFranchise[0])) {
        return [];
      }

      const myBodegaName = userFranchise[0]?.name || "";
      const normalizedName = myBodegaName.toLowerCase().includes("cedi") ? "Bodega Cedi" : "Bodega Pavon";

      // Find shipments that were RECEIVED in this bodega but are no longer here
      const receivedHere = db
        .select({ id: shipmentTracking.shipmentId })
        .from(shipmentTracking)
        .where(
          and(
            eq(shipmentTracking.status, "RECIBIDO_EN_BODEGA"),
            sql`${shipmentTracking.notes} LIKE ${'%Recibido en ' + normalizedName + '%'}`
          )
        );

      // Find shipments that were CREATED in this bodega and already left
      const createdHere = db
        .select({ id: shipments.id })
        .from(shipments)
        .where(
          and(
            eq(shipments.originFranchiseId, franchiseId),
            sql`${shipments.status} != 'CREADO'`
          )
        );

      const conditions = [
        or(
          inArray(shipments.id, receivedHere),
          inArray(shipments.id, createdHere)
        ),
        sql`${shipments.warehouseLocation} != ${normalizedName}`,
        sql`${shipments.status} != 'CREADO'`,
      ];

      if (input?.status && input.status !== "all") {
        conditions.push(eq(shipments.status, input.status));
      }
      if (input?.origin && input.origin !== "all") {
        conditions.push(eq(shipments.originName, input.origin));
      }
      if (input?.destination && input.destination !== "all") {
        conditions.push(eq(shipments.destinationName, input.destination));
      }
      if (input?.search) {
        const searchTerm = `%${input.search}%`;
        conditions.push(
          or(
            sql`${shipments.trackingNumber} LIKE ${searchTerm}`,
            sql`${shipments.invoiceNumber} LIKE ${searchTerm}`,
            sql`${shipments.senderName} LIKE ${searchTerm}`,
            sql`${shipments.originName} LIKE ${searchTerm}`,
            sql`${shipments.destinationName} LIKE ${searchTerm}`,
          )
        );
      }

      const result = await db
        .select()
        .from(shipments)
        .where(and(...conditions))
        .orderBy(desc(shipments.updatedAt))
        .limit(200);

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
      // Pickup routes are truck destinations (Grecia, Palmares, San Ramon)
      // Sabana is a receiving warehouse, NOT a truck route
      const pickupCodes = ["grecia", "san_ramon", "palmares"];
      const isPickupRoute = pickupCodes.includes(destFranchise?.code?.toLowerCase() || "") ||
                            ((destFranchise?.displayName?.toLowerCase() || "").includes("recogida") && !destFranchise?.code?.toLowerCase()?.includes("sabana"));

      return {
        ...shipment[0],
        items,
        tracking: trackingWithActors,
        originFranchise: franchiseMap.get(shipment[0].originFranchiseId),
        destinationFranchise: destFranchise,
        destinationFranchiseId: shipment[0].destinationFranchiseId,
        currentLocation: franchiseMap.get(shipment[0].currentLocationId),
        isPickupRoute,
        stuckAfterRoute: await leftOnClosedRoute(db, shipment[0].id, shipment[0].status),
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
        ? { CREADO: ["ENVIADO_A_DESTINO", "ENVIADO_A_BODEGA", "CANCELADO"], ENVIADO_A_DESTINO: ["RECIBIDO_EN_DESTINO"], RECIBIDO_EN_DESTINO: [], CANCELADO: [], ENVIADO_A_BODEGA: ["RECIBIDO_EN_BODEGA"], RECIBIDO_EN_BODEGA: ["ENVIADO_A_DESTINO", "ENVIADO_A_BODEGA", "RECIBIDO_EN_DESTINO"] }
        : { CREADO: ["ENVIADO_A_BODEGA", "CANCELADO"], ENVIADO_A_BODEGA: ["RECIBIDO_EN_BODEGA"], RECIBIDO_EN_BODEGA: ["ENVIADO_A_DESTINO", "ENVIADO_A_BODEGA", "RECIBIDO_EN_DESTINO"], ENVIADO_A_DESTINO: ["RECIBIDO_EN_DESTINO"], RECIBIDO_EN_DESTINO: [], CANCELADO: [] };

      const allowed = validTransitions[shipment.status] || [];
      if (!allowed.includes(input.newStatus)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `No se puede cambiar de ${shipment.status} a ${input.newStatus}` });
      }

      if (input.newStatus === "ENVIADO_A_DESTINO" || input.newStatus === "ENVIADO_A_BODEGA") {
        const originFranchise = await db.select().from(franchises).where(eq(franchises.id, shipment.originFranchiseId)).limit(1);
        const destFranchise = await db.select().from(franchises).where(eq(franchises.id, shipment.destinationFranchiseId)).limit(1);
        const transfer = needsInterBodega({
          originName: originFranchise[0]?.displayName,
          destinationName: destFranchise[0]?.displayName,
          warehouseLocation: shipment.warehouseLocation,
        });
        if (input.newStatus === "ENVIADO_A_DESTINO" && transfer.needsTransfer) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Este envio debe pasar por ${transfer.targetBodega} antes de ir al destino` });
        }
        if (input.newStatus === "ENVIADO_A_DESTINO" && destFranchise[0]?.isWarehouse === 1 && !isSabanaWarehouse(destFranchise[0])) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Este envio se retira en la bodega. Marcalo como entregado al cliente." });
        }
        if (input.newStatus === "ENVIADO_A_DESTINO" && getFranchiseGroup(destFranchise[0]?.displayName || destFranchise[0]?.name) === "route") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Este envio sale en la ruta del camion. No se envia como una tienda." });
        }
      }

      if (isDriverUsername(ctx.franchiseUser!.username)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "El chofer solo gestiona rutas" });
      }

      // Validate permissions
      if (input.newStatus === "ENVIADO_A_BODEGA" && shipment.originFranchiseId !== franchiseId && !isWarehouse) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo la tienda de origen o la bodega puede marcar como enviado a bodega" });
      } else if (input.newStatus === "RECIBIDO_EN_BODEGA" && !isWarehouse) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo la bodega puede marcar como recibido" });
      } else if (input.newStatus === "ENVIADO_A_DESTINO") {
        if (!isWarehouse) throw new TRPCError({ code: "FORBIDDEN", message: "Solo la bodega puede marcar como enviado a destino" });
      } else if (input.newStatus === "RECIBIDO_EN_DESTINO" && shipment.destinationFranchiseId !== franchiseId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo el destino puede marcar como recibido" });
      } else if (input.newStatus === "RECIBIDO_EN_DESTINO" && shipment.status === "RECIBIDO_EN_BODEGA" && !isWarehouse) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo la bodega de destino puede entregar el paquete al cliente" });
      }

      // Hub warehouse detail actions must match the same rules as bulk receive/send.
      const hubAction =
        input.newStatus === "RECIBIDO_EN_BODEGA" ||
        input.newStatus === "ENVIADO_A_DESTINO" ||
        (input.newStatus === "ENVIADO_A_BODEGA" && isWarehouse && shipment.status === "RECIBIDO_EN_BODEGA");
      let hubPlace: "Bodega Cedi" | "Bodega Pavon" | null = null;
      if (hubAction) {
        hubPlace = assertHubWarehouseOperator(ctx.franchiseUser!, userFranchise[0]);
        assertShipmentAtWarehouse(
          shipment,
          franchiseId,
          hubPlace,
          input.newStatus === "RECIBIDO_EN_BODEGA" ? "recibir" : "enviar",
        );
      }

      let newLocationId = shipment.currentLocationId;
      if (input.newStatus === "ENVIADO_A_BODEGA") {
        const goingTo = (input.warehouseLocation || shipment.warehouseLocation || "").toLowerCase();
        if (goingTo.includes("cedi") && bodegaCedi) newLocationId = bodegaCedi.id;
        else if (goingTo.includes("pavon") && bodegaPavon) newLocationId = bodegaPavon.id;
        else newLocationId = targetBodegaId || shipment.currentLocationId;
      }
      else if (input.newStatus === "RECIBIDO_EN_BODEGA") newLocationId = franchiseId;
      else if (input.newStatus === "ENVIADO_A_DESTINO") newLocationId = shipment.destinationFranchiseId;
      else if (input.newStatus === "RECIBIDO_EN_DESTINO") newLocationId = shipment.destinationFranchiseId;

      // Build update data
      const updateData: Record<string, any> = {
        status: input.newStatus,
        currentLocationId: newLocationId,
      };
      if (input.newStatus === "ENVIADO_A_BODEGA" && input.warehouseLocation) {
        updateData.warehouseLocation = input.warehouseLocation;
      }
      if (input.newStatus === "RECIBIDO_EN_BODEGA") {
        updateData.warehouseLocation = hubPlace || warehouseLocationOf(userFranchise[0]) || input.warehouseLocation;
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
          : shipment.status === "RECIBIDO_EN_BODEGA"
            ? "Entregado al cliente en bodega"
            : "Recibido en tienda de destino",
      };

      await db.insert(shipmentTracking).values({
        shipmentId: input.id,
        status: input.newStatus,
        locationId: newLocationId,
        notes: input.notes || statusNotes[input.newStatus] || `Estado cambiado a ${input.newStatus}`,
        createdBy: ctx.franchiseUser!.id,
      });

      await clearShipmentMarks(db, [input.id]);
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

      if (shipment.originFranchiseId !== franchiseId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo la tienda que creo el envio puede cancelarlo" });
      }
      if (shipment.status !== "CREADO") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se puede cancelar un envio que aun no ha salido" });
      }

      const openRouteRows = await db
        .select({ id: routeShipments.id })
        .from(routeShipments)
        .innerJoin(deliveryRoutes, eq(deliveryRoutes.id, routeShipments.routeId))
        .where(and(
          eq(routeShipments.shipmentId, input.id),
          eq(routeShipments.status, "ASIGNADO"),
          inArray(deliveryRoutes.status, ["PLANIFICADA", "EN_RUTA"]),
        ));
      if (openRouteRows.length > 0) {
        await db.delete(routeShipments).where(inArray(routeShipments.id, openRouteRows.map((row) => row.id)));
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

      await clearShipmentMarks(db, [input.id]);
      return { success: true };
    }),

  reportGap: franchiseAuthedQuery
    .input(z.object({
      id: z.number().int().positive(),
      kind: z.enum(["no_vino", "no_salio"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const meRows = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      const me = meRows[0];
      if (!me) throw new TRPCError({ code: "FORBIDDEN", message: "Franquicia no encontrada" });

      const rows = await db.select().from(shipments).where(eq(shipments.id, input.id)).limit(1);
      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Envio no encontrado" });
      const shipment = rows[0];

      const all = await db.select().from(franchises);
      const origin = all.find((franchise) => franchise.id === shipment.originFranchiseId);
      const warehouses = all.filter((franchise) => franchise.code === "bodega" || franchise.code === "bodega_cedi");
      const myLabel = cleanFranchiseName(me.displayName || me.name);
      let nextStatus: "CREADO" | "RECIBIDO_EN_BODEGA";
      let nextLocation = shipment.originFranchiseId;
      let nextWarehouse = shipment.warehouseLocation;
      let note = "";

      if (shipment.status === "ENVIADO_A_DESTINO") {
        const holder = warehouses.find((franchise) =>
          shipment.warehouseLocation?.toLowerCase().includes("cedi")
            ? franchise.code === "bodega_cedi"
            : franchise.code === "bodega"
        );
        if (!holder) throw new TRPCError({ code: "BAD_REQUEST", message: "No se encontro la bodega que lo envio" });
        const allowed = (input.kind === "no_vino" && shipment.destinationFranchiseId === franchiseId)
          || (input.kind === "no_salio" && franchiseId === holder.id);
        if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "No puedes reportar este paquete" });
        nextStatus = "RECIBIDO_EN_BODEGA";
        nextLocation = holder.id;
        nextWarehouse = holder.code === "bodega_cedi" ? "Bodega Cedi" : "Bodega Pavon";
        note = input.kind === "no_vino" ? `No vino. ${myLabel} no lo recibio` : `No salio. Sigue en ${myLabel}`;
      } else if (shipment.status === "ENVIADO_A_BODEGA") {
        const history = await db.select({ status: shipmentTracking.status }).from(shipmentTracking).where(eq(shipmentTracking.shipmentId, shipment.id));
        const alreadyInAWarehouse = origin?.isWarehouse === 1 || history.some((row) => row.status === "RECIBIDO_EN_BODEGA");
        if (!alreadyInAWarehouse) {
          const allowed = (input.kind === "no_vino" && shipment.currentLocationId === franchiseId)
            || (input.kind === "no_salio" && shipment.originFranchiseId === franchiseId);
          if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "No puedes reportar este paquete" });
          nextStatus = "CREADO";
          nextLocation = shipment.originFranchiseId;
          note = input.kind === "no_vino" ? `No vino. ${myLabel} no lo recibio` : `No salio. Sigue en ${myLabel}`;
        } else {
          const sender = warehouses.find((franchise) => franchise.id !== shipment.currentLocationId);
          if (!sender) throw new TRPCError({ code: "BAD_REQUEST", message: "No se encontro la bodega que lo envio" });
          const allowed = (input.kind === "no_vino" && franchiseId === shipment.currentLocationId)
            || (input.kind === "no_salio" && franchiseId === sender.id);
          if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "No puedes reportar este paquete" });
          nextStatus = "RECIBIDO_EN_BODEGA";
          nextLocation = sender.id;
          nextWarehouse = sender.code === "bodega_cedi" ? "Bodega Cedi" : "Bodega Pavon";
          note = input.kind === "no_vino" ? `No vino. ${myLabel} no lo recibio` : `No salio. Sigue en ${myLabel}`;
        }
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este envio no va en camino. No se puede reportar asi." });
      }

      await db.update(shipments).set({
        status: nextStatus,
        currentLocationId: nextLocation,
        warehouseLocation: nextWarehouse,
      }).where(eq(shipments.id, shipment.id));

      await db.insert(shipmentTracking).values({
        shipmentId: shipment.id,
        status: nextStatus,
        locationId: nextLocation,
        notes: note,
        createdBy: ctx.franchiseUser!.id,
      });

      await clearShipmentMarks(db, [shipment.id]);
      return { success: true };
    }),

  entregarEnTiendaMasiva: franchiseAuthedQuery
    .input(z.object({
      ids: z.array(z.number().int().positive()).min(1).max(100),
      receiverName: z.string().trim().min(2).max(120),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const meRows = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      if (meRows[0]?.isWarehouse === 1) {
        throw new TRPCError({ code: "FORBIDDEN", message: "En bodega la entrega al cliente usa su propio boton" });
      }

      const envios = await db.select().from(shipments).where(inArray(shipments.id, input.ids));
      if (envios.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontraron envios" });
      const invalidos = envios.filter((s) => s.status !== "RECIBIDO_EN_DESTINO" || s.destinationFranchiseId !== franchiseId);
      if (invalidos.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se entregan al cliente los paquetes que ya estan en esta tienda" });
      }

      await db.update(shipments).set({
        status: "ENTREGADO_AL_CLIENTE",
        receiverName: input.receiverName,
        currentLocationId: franchiseId,
      }).where(inArray(shipments.id, input.ids));

      for (const envio of envios) {
        await db.insert(shipmentTracking).values({
          shipmentId: envio.id,
          status: "ENTREGADO_AL_CLIENTE",
          locationId: franchiseId,
          notes: `Entregado al cliente: ${input.receiverName}`,
          createdBy: ctx.franchiseUser!.id,
        });
      }

      await keepShipmentTrip(db, franchiseId, "Entrega al cliente", input.ids);
      return { success: true, count: envios.length };
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
      // Pickup routes are truck destinations (Grecia, Palmares, San Ramon)
      // Sabana is a receiving warehouse, NOT a truck route
      const pickupCodes = ["grecia", "san_ramon", "palmares"];
      const isPickupRoute = pickupCodes.includes(destFranchise?.code?.toLowerCase() || "") ||
                            ((destFranchise?.displayName?.toLowerCase() || "").includes("recogida") && !destFranchise?.code?.toLowerCase()?.includes("sabana"));

      const destFranchiseData = franchiseMap.get(shipment[0].destinationFranchiseId);
      const originFranchiseData = franchiseMap.get(shipment[0].originFranchiseId);
      const originIsWarehouse = originFranchiseData?.isWarehouse === 1;
      const destIsWarehouse = destFranchiseData?.isWarehouse === 1;
      console.log("[track] destFranchise:", destFranchiseData?.displayName, "isWarehouse:", destFranchiseData?.isWarehouse, "destId:", shipment[0].destinationFranchiseId);

      const timelineSteps = buildTimelineSteps(
        isPickupRoute,
        originIsWarehouse,
        destIsWarehouse,
        originFranchiseData?.displayName,
        destFranchiseData?.displayName
      );

      const { senderPhone: _hiddenPhone, ...publicShipment } = shipment[0];
      void _hiddenPhone;

      return {
        ...publicShipment,
        items,
        tracking: trackingHistory,
        originFranchise: originFranchiseData,
        destinationFranchise: destFranchiseData,
        destinationFranchiseId: shipment[0].destinationFranchiseId,
        destinationIsWarehouse: destIsWarehouse,
        currentLocation: franchiseMap.get(shipment[0].currentLocationId),
        isPickupRoute,
        timelineSteps,
        warehouseLocation: shipment[0].warehouseLocation,
        stuckAfterRoute: await leftOnClosedRoute(db, shipment[0].id, shipment[0].status),
      };
    }),

  // ─── Stats ─────────────────────────────────────────────────────
  stats: franchiseAuthedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const franchiseId = ctx.franchiseUser!.franchiseId;
    const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
    const isWarehouse = userFranchise[0]?.isWarehouse === 1;

    let whereClause;
    if (isWarehouse && isSabanaWarehouse(userFranchise[0])) {
      whereClause = or(
        eq(shipments.destinationFranchiseId, franchiseId),
        eq(shipments.currentLocationId, franchiseId),
      );
    } else if (isWarehouse) {
      const myBodegaName = userFranchise[0]?.name || "";
      const isCedi = myBodegaName.toLowerCase().includes("cedi");
      const normalizedName = isCedi ? "Bodega Cedi" : "Bodega Pavon";
      whereClause = isCedi
        ? eq(shipments.warehouseLocation, normalizedName)
        : or(eq(shipments.warehouseLocation, normalizedName), sql`${shipments.warehouseLocation} IS NULL`);
    } else {
      whereClause = or(
        eq(shipments.originFranchiseId, franchiseId),
        eq(shipments.destinationFranchiseId, franchiseId),
        eq(shipments.currentLocationId, franchiseId),
        sql`${shipments.status} = 'ENVIADO_A_DESTINO' AND ${shipments.destinationFranchiseId} = ${franchiseId}`,
      );
    }

    const allShipments = await db.select().from(shipments).where(whereClause);
    const done = new Set(["RECIBIDO_EN_DESTINO", "ENTREGADO_AL_CLIENTE", "CANCELADO"]);
    const pending = allShipments.filter((s) => !done.has(s.status));

    return {
      total: allShipments.length,
      pending: pending.length,
      delivered: allShipments.filter((s) => s.status === "RECIBIDO_EN_DESTINO" || s.status === "ENTREGADO_AL_CLIENTE").length,
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

    if (isWarehouse && isSabanaWarehouse(userFranchise[0])) {
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(shipments)
        .where(and(
          eq(shipments.status, "ENVIADO_A_DESTINO"),
          eq(shipments.destinationFranchiseId, franchiseId),
        ));
      return countResult[0]?.count || 0;
    }

    if (isWarehouse) {
      // Warehouse: count ENVIADO_A_BODEGA assigned to this warehouse
      const myBodegaName = userFranchise[0]?.name || "";
      const normalizedName = myBodegaName.toLowerCase().includes("cedi") ? "Bodega Cedi" : "Bodega Pavon";
      const locationFilter = normalizedName === "Bodega Pavon"
        ? or(eq(shipments.warehouseLocation, normalizedName), sql`${shipments.warehouseLocation} IS NULL`)
        : eq(shipments.warehouseLocation, normalizedName);
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(shipments)
        .where(and(
          eq(shipments.status, "ENVIADO_A_BODEGA"),
          locationFilter,
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
          sql`${shipments.status} = 'RECIBIDO_EN_DESTINO' AND ${shipments.destinationFranchiseId} = ${franchiseId}`,
        ));
      return countResult[0]?.count || 0;
    }
  }),

  // ─── Get Boleta (printable receipt for package) ────────────────
  getBoleta: franchiseAuthedQuery
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
        .where(inArray(shipments.id, input.ids));

      // Packages already confirmed in a saved trip for this franchise can always
      // be reprinted, even after their status moved on.
      await ensureShipmentTrips(db);
      const trips = await db
        .select({ shipmentIds: shipmentTrips.shipmentIds })
        .from(shipmentTrips)
        .where(eq(shipmentTrips.franchiseId, franchiseId));
      const tripShipmentIds = new Set<number>();
      for (const trip of trips) {
        for (const part of String(trip.shipmentIds || "").split(",")) {
          const id = Number(part.trim());
          if (Number.isFinite(id) && id > 0) tripShipmentIds.add(id);
        }
      }

      const filtered = result.filter((s) =>
        tripShipmentIds.has(s.id) ||
        s.originFranchiseId === franchiseId ||
        s.destinationFranchiseId === franchiseId ||
        s.currentLocationId === franchiseId ||
        (isWarehouse && (s.status === "ENVIADO_A_BODEGA" || s.status === "RECIBIDO_EN_BODEGA" || s.status === "ENVIADO_A_DESTINO" || s.status === "RECIBIDO_EN_DESTINO" || s.status === "ENTREGADO_AL_CLIENTE"))
      );

      // Keep the same package order as the trip / selection, not createdAt.
      const order = new Map(input.ids.map((id, index) => [id, index]));
      filtered.sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));

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

      await keepShipmentTrip(db, franchiseId, "Salida a bodega", input.ids);
      return { success: true, count: envios.length };
    }),

  // ─── Recibir en Bodega Masiva ─────────────────────────────────
  recibirEnBodegaMasiva: franchiseAuthedQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      const normalizedName = assertHubWarehouseOperator(ctx.franchiseUser!, userFranchise[0]);

      const envios = await db.select().from(shipments).where(inArray(shipments.id, input.ids));
      if (envios.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontraron envios" });

      for (const envio of envios) {
        assertShipmentAtWarehouse(envio, franchiseId, normalizedName, "recibir");
      }

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

      await keepShipmentTrip(db, franchiseId, "Recepcion en bodega", input.ids);
      return { success: true, count: envios.length };
    }),

  // ─── Enviar a Destino Masiva ──────────────────────────────────
  enviarADestinoMasiva: franchiseAuthedQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      const myWarehouse = assertHubWarehouseOperator(ctx.franchiseUser!, userFranchise[0]);

      const envios = await db.select().from(shipments).where(inArray(shipments.id, input.ids));
      if (envios.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontraron envios" });

      // Validar que todos esten en RECIBIDO_EN_BODEGA o CREADO (bodega puede enviar ambos)
      const invalidos = envios.filter((s) => s.status !== "RECIBIDO_EN_BODEGA" && s.status !== "CREADO");
      if (invalidos.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${invalidos.length} envio(s) no estan en estado valido para enviar a destino` });
      }
      for (const envio of envios) {
        assertShipmentAtWarehouse(envio, franchiseId, myWarehouse, "enviar");
      }

      const allFranchises = await db.select().from(franchises);
      const franchiseById = new Map(allFranchises.map((franchise) => [franchise.id, franchise]));
      const mustTransfer = envios.filter((envio) => needsInterBodega({
        originName: franchiseRouteName(franchiseById.get(envio.originFranchiseId)),
        destinationName: franchiseRouteName(franchiseById.get(envio.destinationFranchiseId)),
        warehouseLocation: envio.warehouseLocation,
      }).needsTransfer);
      if (mustTransfer.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${mustTransfer.length} envio(s) deben pasar por la otra bodega antes de ir al destino` });
      }
      const customerPickup = envios.filter((envio) => {
        const dest = franchiseById.get(envio.destinationFranchiseId);
        return dest?.isWarehouse === 1 && !isSabanaWarehouse(dest);
      });
      if (customerPickup.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${customerPickup.length} envio(s) se retiran en la bodega. Marcalos como entregado al cliente.` });
      }
      const onTruck = envios.filter((envio) => {
        const dest = franchiseById.get(envio.destinationFranchiseId);
        return getFranchiseGroup(dest?.displayName || dest?.name) === "route";
      });
      if (onTruck.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${onTruck.length} envio(s) salen en la ruta del camion. No se envian como una tienda.` });
      }

      for (const envio of envios) {
        const destLabel = cleanFranchiseName(
          franchiseById.get(envio.destinationFranchiseId)?.displayName ||
          franchiseById.get(envio.destinationFranchiseId)?.name
        ).replace(/^Recogida\s*-\s*/i, "");
        await db
          .update(shipments)
          .set({ status: "ENVIADO_A_DESTINO", currentLocationId: envio.destinationFranchiseId })
          .where(eq(shipments.id, envio.id));
        await db.insert(shipmentTracking).values({
          shipmentId: envio.id,
          status: "ENVIADO_A_DESTINO",
          locationId: envio.destinationFranchiseId,
          notes: `Enviado hacia ${destLabel}`,
          createdBy: ctx.franchiseUser!.id,
        });
      }

      await keepShipmentTrip(db, franchiseId, "Envio a destino", input.ids);
      return { success: true, count: envios.length };
    }),

  // ─── Enviar a Inter-Bodega Masiva ──────────────────────────────
  // Used when bodega sends packages to another bodega (e.g. Bodega Pavon -> Bodega Cedi)
  enviarAInterBodegaMasiva: franchiseAuthedQuery
    .input(z.object({ ids: z.array(z.number()).min(1), targetBodega: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      const myName = assertHubWarehouseOperator(ctx.franchiseUser!, userFranchise[0]);

      const envios = await db.select().from(shipments).where(inArray(shipments.id, input.ids));
      if (envios.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontraron envios" });

      // Validar que todos esten en RECIBIDO_EN_BODEGA o CREADO
      const invalidos = envios.filter((s) => s.status !== "RECIBIDO_EN_BODEGA" && s.status !== "CREADO");
      if (invalidos.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${invalidos.length} envio(s) no estan en estado valido para enviar a otra bodega` });
      }
      for (const envio of envios) {
        assertShipmentAtWarehouse(envio, franchiseId, myName, "enviar");
      }

      const allFranchises = await db.select().from(franchises);
      const franchiseById = new Map(allFranchises.map((franchise) => [franchise.id, franchise]));
      const targetBodega = canonicalBodega(input.targetBodega);
      const wrongRoute = envios.filter((envio) => {
        const move = needsInterBodega({
          originName: franchiseRouteName(franchiseById.get(envio.originFranchiseId)),
          destinationName: franchiseRouteName(franchiseById.get(envio.destinationFranchiseId)),
          warehouseLocation: envio.warehouseLocation,
        });
        return !move.needsTransfer || canonicalBodega(move.targetBodega) !== targetBodega;
      });
      if (wrongRoute.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${wrongRoute.length} envio(s) no deben ir a ${targetBodega}. Sepáralos de los que sí siguen hacia esa bodega.`,
        });
      }

      // Inter-bodega: set warehouseLocation to TARGET bodega so it appears
      // in the destination bodega's "Por Recibir" filter
      const targetWarehouse = allFranchises.find((franchise) =>
        targetBodega === "Bodega Cedi"
          ? franchise.code === "bodega_cedi"
          : franchise.code === "bodega"
      );
      if (!targetWarehouse) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `No se encontro ${targetBodega} para recibir estos envios` });
      }
      await db
        .update(shipments)
        .set({
          status: "ENVIADO_A_BODEGA",
          warehouseLocation: targetBodega,
          currentLocationId: targetWarehouse.id,
        })
        .where(inArray(shipments.id, input.ids));

      for (const envio of envios) {
        await db.insert(shipmentTracking).values({
          shipmentId: envio.id,
          status: "ENVIADO_A_BODEGA",
          locationId: franchiseId,
          notes: `Enviado desde ${myName} hacia ${targetBodega} (${envios.length} envios en lote)`,
          createdBy: ctx.franchiseUser!.id,
        });
      }

      await keepShipmentTrip(db, franchiseId, `Envio a ${targetBodega}`, input.ids);
      return { success: true, count: envios.length };
    }),
  recibirEnDestinoMasiva: franchiseAuthedQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;

      // Verificar que NO sea bodega (solo tiendas)
      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      if (userFranchise[0]?.isWarehouse === 1 && !isSabanaWarehouse(userFranchise[0])) {
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
          notes: `Recibido en ${cleanFranchiseName(userFranchise[0]?.displayName || userFranchise[0]?.name)}`,
          createdBy: ctx.franchiseUser!.id,
        });
      }

      await keepShipmentTrip(db, franchiseId, "Recepcion", input.ids);
      return { success: true, count: envios.length };
    }),

  entregarAlClienteMasiva: franchiseAuthedQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      const normalizedName = assertHubWarehouseOperator(ctx.franchiseUser!, userFranchise[0]);

      const envios = await db.select().from(shipments).where(inArray(shipments.id, input.ids));
      if (envios.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontraron envios" });

      const invalidos = envios.filter((s) => s.status !== "RECIBIDO_EN_BODEGA" || s.destinationFranchiseId !== franchiseId);
      if (invalidos.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${invalidos.length} envio(s) no estan listos para entrega al cliente en esta bodega` });
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
          notes: `Entregado al cliente en ${normalizedName} (${envios.length} envios en lote)`,
          createdBy: ctx.franchiseUser!.id,
        });
      }

      await keepShipmentTrip(db, franchiseId, "Entrega al cliente", input.ids);
      return { success: true, count: envios.length };
    }),

  recentTrips: franchiseAuthedQuery
    .query(async ({ ctx }) => {
      const db = getDb();
      await ensureShipmentTrips(db);
      const rows = await db.select().from(shipmentTrips).where(
        eq(shipmentTrips.franchiseId, ctx.franchiseUser!.franchiseId),
      ).orderBy(desc(shipmentTrips.createdAt)).limit(30);

      const allIds = [...new Set(
        rows.flatMap((row) =>
          String(row.shipmentIds || "")
            .split(",")
            .map((part) => Number(part.trim()))
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      )];

      const shipmentById = new Map<number, {
        trackingNumber: string;
        originName: string;
        destinationName: string;
      }>();

      if (allIds.length > 0) {
        const allFranchises = await db.select().from(franchises);
        const franchiseMap = new Map(allFranchises.map((f) => [f.id, f]));
        const envios = await db
          .select({
            id: shipments.id,
            trackingNumber: shipments.trackingNumber,
            originFranchiseId: shipments.originFranchiseId,
            destinationFranchiseId: shipments.destinationFranchiseId,
          })
          .from(shipments)
          .where(inArray(shipments.id, allIds));

        for (const envio of envios) {
          const origin = franchiseMap.get(envio.originFranchiseId);
          const destination = franchiseMap.get(envio.destinationFranchiseId);
          shipmentById.set(envio.id, {
            trackingNumber: envio.trackingNumber,
            originName: cleanFranchiseName(origin?.displayName || origin?.name),
            destinationName: cleanFranchiseName(destination?.displayName || destination?.name),
          });
        }
      }

      const summarizePlaces = (names: string[]) => {
        const unique = [...new Set(names.filter(Boolean))];
        if (unique.length === 0) return "";
        if (unique.length === 1) return unique[0];
        if (unique.length === 2) return `${unique[0]}, ${unique[1]}`;
        return `${unique.slice(0, 2).join(", ")} +${unique.length - 2}`;
      };

      return rows.map((row) => {
        const ids = String(row.shipmentIds || "")
          .split(",")
          .map((part) => Number(part.trim()))
          .filter((id) => Number.isFinite(id) && id > 0);
        const packages = ids.map((id) => shipmentById.get(id)).filter(Boolean) as {
          trackingNumber: string;
          originName: string;
          destinationName: string;
        }[];

        const labelLower = (row.label || "").toLowerCase();
        const useOrigins = labelLower.includes("recepcion") || labelLower.includes("recepción");
        const places = summarizePlaces(
          packages.map((pkg) => (useOrigins ? pkg.originName : pkg.destinationName)),
        );
        const routeSummary = places
          ? `${useOrigins ? "Desde" : "Hacia"} ${places}`
          : "";

        const trackings = packages.map((pkg) => pkg.trackingNumber).filter(Boolean);
        const sampleTracking = trackings[0] || "";
        const extraTracking = Math.max(0, trackings.length - 1);

        return {
          id: row.id,
          label: row.label,
          packageCount: row.packageCount,
          createdAt: row.createdAt,
          shipmentIds: row.shipmentIds,
          routeSummary,
          sampleTracking,
          extraTracking,
        };
      });
    }),

  marks: franchiseAuthedQuery
    .input(z.object({ tab: markTabSchema }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      await ensureShipmentMarks(db);
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const rows = await db.select({ shipmentId: shipmentMarks.shipmentId }).from(shipmentMarks).where(and(
        eq(shipmentMarks.franchiseId, franchiseId),
        eq(shipmentMarks.tab, input.tab),
      ));
      const ids = rows.map((row) => row.shipmentId);
      if (ids.length === 0) return { ids: [] };

      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      const isWarehouse = userFranchise[0]?.isWarehouse === 1;
      const isSabana = isSabanaWarehouse(userFranchise[0]);
      const allowed = new Set(markStatusesForTab(input.tab, isWarehouse, isSabana));

      const envios = await db
        .select({ id: shipments.id, status: shipments.status })
        .from(shipments)
        .where(inArray(shipments.id, ids));
      const byId = new Map(envios.map((envio) => [envio.id, envio]));

      const valid: number[] = [];
      const stale: number[] = [];
      for (const id of ids) {
        const envio = byId.get(id);
        if (envio && allowed.has(envio.status)) valid.push(id);
        else stale.push(id);
      }

      if (stale.length > 0) {
        await db.delete(shipmentMarks).where(and(
          eq(shipmentMarks.franchiseId, franchiseId),
          eq(shipmentMarks.tab, input.tab),
          inArray(shipmentMarks.shipmentId, stale),
        ));
      }

      return { ids: valid };
    }),

  addMarks: franchiseAuthedQuery
    .input(z.object({ tab: markTabSchema, ids: z.array(z.number().int().positive()).min(1).max(300) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await ensureShipmentMarks(db);
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const existing = await db.select({ shipmentId: shipmentMarks.shipmentId }).from(shipmentMarks).where(and(
        eq(shipmentMarks.franchiseId, franchiseId),
        eq(shipmentMarks.tab, input.tab),
        inArray(shipmentMarks.shipmentId, input.ids),
      ));
      const have = new Set(existing.map((row) => row.shipmentId));
      const fresh = [...new Set(input.ids)].filter((id) => !have.has(id));
      if (fresh.length > 0) {
        await db.insert(shipmentMarks).values(fresh.map((shipmentId) => ({
          franchiseId,
          tab: input.tab,
          shipmentId,
        })));
      }
      return { success: true };
    }),

  removeMarks: franchiseAuthedQuery
    .input(z.object({ tab: markTabSchema, ids: z.array(z.number().int().positive()).min(1).max(300) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await ensureShipmentMarks(db);
      await db.delete(shipmentMarks).where(and(
        eq(shipmentMarks.franchiseId, ctx.franchiseUser!.franchiseId),
        eq(shipmentMarks.tab, input.tab),
        inArray(shipmentMarks.shipmentId, input.ids),
      ));
      return { success: true };
    }),

  // ─── MONTHLY REPORT BY FRANCHISE ──────────────────────────────
  monthlyReport: franchiseAuthedQuery
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
