import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { franchises } from "@db/schema";
import { getDb } from "../queries/connection";
import { env } from "./env";

export type FranchiseActor = {
  id: number;
  username: string;
  franchiseId: number;
};

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

export function getClientIP(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") || "unknown";
}

export function jwtSecretBytes(): Uint8Array {
  return new TextEncoder().encode(env.jwtSecret);
}

export function cookieSecureFlag(): boolean {
  return env.isProduction || process.env.COOKIE_SECURE === "1";
}

export function isDriverUsername(username: string | null | undefined): boolean {
  return (username || "").trim().toLowerCase() === "chofer";
}

export function isPasswordManagerUsername(username: string | null | undefined): boolean {
  const name = (username || "").trim().toLowerCase();
  return name === "bodega" || name === "bodega_cedi";
}

export function assertPasswordManagerUser(username: string | null | undefined) {
  if (!isPasswordManagerUsername(username)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Solo Bodega Pavon y Bodega Cedi cambian claves.",
    });
  }
}

export function warehouseLocationOf(
  franchise: { code?: string | null; name?: string | null; displayName?: string | null } | undefined,
): "Bodega Cedi" | "Bodega Pavon" | "Bodega Sabana" | null {
  if (!franchise) return null;
  const text = `${franchise.code || ""} ${franchise.name || ""} ${franchise.displayName || ""}`.toLowerCase();
  if (text.includes("sabana")) return "Bodega Sabana";
  if (text.includes("cedi")) return "Bodega Cedi";
  if (text.includes("pavon") || franchise.code === "bodega") return "Bodega Pavon";
  return null;
}

/** Warehouse staff (not chofer, not Sabana) who receive/send at a bodega hub. */
export function assertHubWarehouseOperator(
  actor: FranchiseActor,
  franchise: { isWarehouse?: number | null; code?: string | null; name?: string | null; displayName?: string | null },
): "Bodega Cedi" | "Bodega Pavon" {
  if (isDriverUsername(actor.username)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "El chofer no recibe ni envia en bodega" });
  }
  if (franchise.isWarehouse !== 1) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Solo la bodega puede hacer esta accion" });
  }
  const place = warehouseLocationOf(franchise);
  if (place !== "Bodega Cedi" && place !== "Bodega Pavon") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Esta bodega no usa este flujo" });
  }
  return place;
}

export function assertShipmentAtWarehouse(
  shipment: { warehouseLocation?: string | null; currentLocationId?: number | null; status: string },
  franchiseId: number,
  warehouseLocation: "Bodega Cedi" | "Bodega Pavon",
  action: "recibir" | "enviar",
) {
  if (action === "recibir") {
    if (shipment.status !== "ENVIADO_A_BODEGA") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Ese envio no esta pendiente de recepcion en bodega" });
    }
    const loc = shipment.warehouseLocation || null;
    const matches =
      loc === warehouseLocation ||
      (warehouseLocation === "Bodega Pavon" && (loc === null || loc === ""));
    if (!matches) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Ese envio va a ${loc || "otra bodega"}, no a ${warehouseLocation}`,
      });
    }
    return;
  }

  // enviar / inter-bodega: package must already be at this warehouse
  if (shipment.currentLocationId !== franchiseId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Ese envio no esta en esta bodega",
    });
  }
  if (shipment.warehouseLocation && shipment.warehouseLocation !== warehouseLocation) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Ese envio esta marcado en ${shipment.warehouseLocation}`,
    });
  }
}

export async function assertRouteOperator(actor: FranchiseActor) {
  if (isDriverUsername(actor.username)) return;
  const db = getDb();
  const rows = await db.select().from(franchises).where(eq(franchises.id, actor.franchiseId)).limit(1);
  const code = rows[0]?.code?.toLowerCase();
  if (code === "bodega_cedi") return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Solo el chofer o Bodega Cedi pueden gestionar rutas",
  });
}
