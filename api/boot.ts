import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import { getDb } from "./queries/connection";
import { franchises, franchiseUsers, shipments, shipmentTracking, routeShipments, routeStops, deliveryRoutes } from "@db/schema";
import { inArray, notInArray, eq } from "drizzle-orm";
import { createHash } from "crypto";
import mysql from "mysql2/promise";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

// Todas las franquicias (incluye puntos de recogida para envios)
const franchiseData = [
  { name: "Los Chiles", displayName: "American Outlet Los Chiles", code: "los_chiles", isWarehouse: 0 },
  { name: "Pavon", displayName: "American Outlet Pavon", code: "pavon", isWarehouse: 0 },
  { name: "Santa Rosa", displayName: "American Outlet Santa Rosa", code: "santa_rosa", isWarehouse: 0 },
  { name: "Boca Arenal", displayName: "American Outlet Boca Arenal", code: "boca_arenal", isWarehouse: 0 },
  { name: "Florencia", displayName: "American Outlet Florencia", code: "florencia", isWarehouse: 0 },
  { name: "Fortuna", displayName: "American Outlet Fortuna", code: "fortuna", isWarehouse: 0 },
  { name: "Ciudad Quesada", displayName: "American Outlet Ciudad Quesada", code: "ciudad_quesada", isWarehouse: 0 },
  { name: "Puerto Viejo", displayName: "American Outlet Puerto Viejo", code: "puerto_viejo", isWarehouse: 0 },
  { name: "Ganga Santa Rosa", displayName: "American Outlet Ganga Santa Rosa", code: "ganga_santa_rosa", isWarehouse: 0 },
  { name: "Bodega Sabana", displayName: "American Outlet Bodega Sabana", code: "bodega_sabana", isWarehouse: 0 },
  { name: "Grecia", displayName: "Recogida - Grecia", code: "grecia", isWarehouse: 0 },
  { name: "San Ramon", displayName: "Recogida - San Ramon", code: "san_ramon", isWarehouse: 0 },
  { name: "Palmares", displayName: "Recogida - Palmares", code: "palmares", isWarehouse: 0 },
  { name: "Bodega", displayName: "American Outlet Bodega", code: "bodega", isWarehouse: 1 },
];

// Solo franquicias que tienen login (excluye puntos de recogida)
const loginFranchiseData = franchiseData.filter(f => !f.displayName.toLowerCase().includes("recogida"));

async function initTables() {
  try {
    console.log("[init] Checking tables...");
    const connection = await mysql.createConnection(env.databaseUrl);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS franchises (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        displayName VARCHAR(255) NOT NULL,
        code VARCHAR(20) NOT NULL UNIQUE,
        isWarehouse TINYINT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS franchise_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        franchiseId INT NOT NULL,
        username VARCHAR(100) NOT NULL UNIQUE,
        passwordHash VARCHAR(255) NOT NULL,
        displayName VARCHAR(255) NOT NULL,
        role ENUM('staff','admin') DEFAULT 'staff',
        isActive TINYINT DEFAULT 1,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS shipments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        trackingNumber VARCHAR(50) NOT NULL UNIQUE,
        invoiceNumber VARCHAR(50),
        senderName VARCHAR(255) NOT NULL,
        senderPhone VARCHAR(50) NOT NULL,
        originFranchiseId INT NOT NULL,
        destinationFranchiseId INT NOT NULL,
        currentLocationId INT NOT NULL,
        status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','EN_RUTA','EN_PARADA','CANCELADO') DEFAULT 'CREADO',
        receiverName VARCHAR(255),
        notes TEXT,
        createdBy INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS shipment_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shipmentId INT NOT NULL,
        description VARCHAR(500) NOT NULL,
        quantity INT DEFAULT 1,
        details VARCHAR(500),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS shipment_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shipmentId INT NOT NULL,
        status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','EN_RUTA','EN_PARADA','CANCELADO') NOT NULL,
        locationId INT NOT NULL,
        notes TEXT,
        createdBy INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS delivery_routes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        status ENUM('PLANIFICADA','EN_RUTA','COMPLETADA','CANCELADA') DEFAULT 'PLANIFICADA',
        createdBy INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS route_stops (
        id INT AUTO_INCREMENT PRIMARY KEY,
        routeId INT NOT NULL,
        cityName VARCHAR(100) NOT NULL,
        stopOrder INT DEFAULT 1,
        status ENUM('PENDIENTE','LLEGADO','COMPLETADO') DEFAULT 'PENDIENTE',
        arrivalTime TIMESTAMP NULL,
        departureTime TIMESTAMP NULL,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS route_shipments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        routeId INT NOT NULL,
        stopId INT NOT NULL,
        shipmentId INT NOT NULL,
        status ENUM('ASIGNADO','ENTREGADO','NO_RECOGIDO') DEFAULT 'ASIGNADO',
        deliveredAt TIMESTAMP NULL,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.end();
    console.log("[init] Tables OK!");
  } catch (err: any) {
    console.error("[init] Table init failed:", err.message);
  }
}

async function runSeed() {
  try {
    console.log("[seed] Running database seed...");
    const db = getDb();

    // 1. Create ALL franchises (including pickup points as destinations)
    for (const f of franchiseData) {
      const existing = await db
        .select()
        .from(franchises)
        .where(eq(franchises.code, f.code));

      if (existing.length === 0) {
        await db.insert(franchises).values(f);
        console.log(`[seed] Created franchise: ${f.displayName}`);
      } else {
        console.log(`[seed] Franchise exists: ${f.displayName}`);
      }
    }

    // 2. Create login users ONLY for stores (NOT pickup points)
    for (const f of loginFranchiseData) {
      const existingFranchise = await db.select().from(franchises).where(eq(franchises.code, f.code)).limit(1);
      if (existingFranchise.length === 0) continue;
      const franchiseId = existingFranchise[0].id;

      const existingUser = await db.select().from(franchiseUsers).where(eq(franchiseUsers.username, f.code)).limit(1);
      if (existingUser.length === 0) {
        await db.insert(franchiseUsers).values({
          franchiseId,
          username: f.code,
          passwordHash: hashPassword("american2025"),
          displayName: f.displayName,
          role: f.isWarehouse ? "admin" : "staff",
          isActive: 1,
        });
        console.log(`[seed] Created user: ${f.displayName} (user: ${f.code} / pass: american2025)`);
      } else {
        console.log(`[seed] User exists: ${f.code}`);
      }
    }

    // Create driver user (associated with warehouse)
    try {
      const bodegaFranchise = await db.select().from(franchises).where(eq(franchises.code, "bodega")).limit(1);
      if (bodegaFranchise.length > 0) {
        const bodegaId = bodegaFranchise[0].id;
        const existingDriver = await db.select().from(franchiseUsers).where(eq(franchiseUsers.username, "chofer")).limit(1);
        if (existingDriver.length === 0) {
          await db.insert(franchiseUsers).values({
            franchiseId: bodegaId,
            username: "chofer",
            passwordHash: hashPassword("american2025"),
            displayName: "Chofer - Rutas",
            role: "admin",
            isActive: 1,
          });
          console.log("[seed] Created: Chofer (user: chofer / pass: american2025)");
        }
      }
    } catch (e: any) {
      console.log("[seed] Skip chofer:", e.message);
    }

    console.log("[seed] Seed complete! All franchises ready.");
  } catch (err: any) {
    console.error("[seed] Seed failed:", err.message);
  }
}

const app = new Hono<{ Bindings: HttpBindings }>();

// Import franchise auth utilities
async function createFranchiseToken(userId: number): Promise<string> {
  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || "american-outlet-dev-key-change-in-prod");
  return new SignJWT({ userId, type: "franchise" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

// REST endpoint for franchise login (bypasses tRPC body issue)
app.post("/api/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const username = (body.username || "").trim().toLowerCase();
    const password = (body.password || "").trim();

    console.log(`[login] Attempt: username="${username}" password_length=${password.length}`);

    if (!username || !password) {
      console.log("[login] Rejected: missing username or password");
      return c.json({ error: "Usuario y contraseña requeridos" }, 400);
    }

    const db = getDb();

    // ─── AUTO-SEED: Ensure all franchises exist, but only create login users for real stores ───
    console.log("[login] Running auto-seed...");

    // 1. Ensure ALL franchises exist (including pickup points as destinations)
    for (const f of franchiseData) {
      try {
        const existingFranchise = await db.select().from(franchises).where(eq(franchises.code, f.code)).limit(1);
        if (existingFranchise.length === 0) {
          await db.insert(franchises).values(f);
          console.log(`[login][seed] Created franchise: ${f.displayName}`);
        }
      } catch (e: any) {
        console.error(`[login][seed] ERROR creating franchise ${f.code}:`, e.message);
      }
    }

    // 2. Ensure login users exist ONLY for stores (NOT pickup points)
    for (const f of loginFranchiseData) {
      try {
        // 1. Ensure franchise exists
        const existingFranchise = await db.select().from(franchises).where(eq(franchises.code, f.code)).limit(1);
        let franchiseId: number;

        if (existingFranchise.length === 0) {
          const result = await db.insert(franchises).values(f);
          franchiseId = Number(result[0].insertId);
          console.log(`[login][seed] Created franchise: ${f.displayName} (id=${franchiseId})`);
        } else {
          franchiseId = existingFranchise[0].id;
        }

        // 2. Ensure user exists for this franchise
        const existingUser = await db.select().from(franchiseUsers).where(eq(franchiseUsers.username, f.code)).limit(1);
        if (existingUser.length === 0) {
          await db.insert(franchiseUsers).values({
            franchiseId,
            username: f.code,
            passwordHash: hashPassword("american2025"),
            displayName: f.displayName,
            role: f.isWarehouse ? "admin" : "staff",
            isActive: 1,
          });
          console.log(`[login][seed] Created user: ${f.code} (franchiseId=${franchiseId})`);
        }
      } catch (e: any) {
        console.error(`[login][seed] ERROR for ${f.code}:`, e.message);
      }
    }

    // 3. Ensure driver user exists
    try {
      const bodegaFranchise = await db.select().from(franchises).where(eq(franchises.code, "bodega")).limit(1);
      if (bodegaFranchise.length > 0) {
        const existingDriver = await db.select().from(franchiseUsers).where(eq(franchiseUsers.username, "chofer")).limit(1);
        if (existingDriver.length === 0) {
          await db.insert(franchiseUsers).values({
            franchiseId: bodegaFranchise[0].id,
            username: "chofer",
            passwordHash: hashPassword("american2025"),
            displayName: "Chofer - Rutas",
            role: "admin",
            isActive: 1,
          });
          console.log("[login][seed] Created driver: chofer");
        }
      }
    } catch (e: any) {
      console.error("[login][seed] ERROR creating chofer:", e.message);
    }
    console.log("[login] Auto-seed complete.");

    // ─── AUTHENTICATE ───
    const users = await db
      .select()
      .from(franchiseUsers)
      .where(eq(franchiseUsers.username, username))
      .limit(1);

    console.log(`[login] User lookup: found=${users.length}, username="${username}"`);

    if (users.length === 0) {
      // List all existing users for debugging
      const allUsers = await db.select({ username: franchiseUsers.username, displayName: franchiseUsers.displayName }).from(franchiseUsers);
      console.log("[login] Available users:", allUsers.map(u => u.username));
      return c.json({ error: "Usuario o contraseña incorrectos" }, 401);
    }

    const user = users[0];
    const expectedHash = hashPassword(password);
    const passwordMatch = user.passwordHash === expectedHash;
    console.log(`[login] Password check: match=${passwordMatch}, stored_hash=${user.passwordHash?.slice(0, 16)}..., computed_hash=${expectedHash?.slice(0, 16)}..., isActive=${user.isActive}`);

    if (!passwordMatch) {
      return c.json({ error: "Usuario o contraseña incorrectos" }, 401);
    }

    if (!user.isActive) {
      return c.json({ error: "Usuario inactivo" }, 401);
    }

    // Create JWT token and set cookie
    const token = await createFranchiseToken(user.id);
    const cookieModule = await import("cookie");
    const cookieValue = cookieModule.serialize("franchise_sid", token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60,
    });
    c.res.headers.append("Set-Cookie", cookieValue);

    // Get franchise data
    const franchiseData2 = await db
      .select()
      .from(franchises)
      .where(eq(franchises.id, user.franchiseId))
      .limit(1);

    const franchise = franchiseData2[0];
    console.log(`[login] SUCCESS: user=${user.username}, role=${user.role}, franchise=${franchise?.displayName}`);

    return c.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        franchiseId: user.franchiseId,
        franchise: franchise || null,
      },
    });
  } catch (err: any) {
    console.error("[login] CRITICAL ERROR:", err.message, err.stack);
    return c.json({ error: "Error del servidor: " + err.message }, 500);
  }
});

// REST endpoint for current user (verifies JWT cookie)
app.get("/api/auth/me", async (c) => {
  try {
    const cookieHeader = c.req.header("cookie") || "";
    const cookies = (await import("cookie")).parse(cookieHeader);
    const token = cookies["franchise_sid"];
    if (!token) return c.json(null);

    const { jwtVerify } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "american-outlet-dev-key-change-in-prod");
    const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 });

    if (!payload || payload.type !== "franchise" || !payload.userId) {
      return c.json(null);
    }

    const db = getDb();
    const users = await db
      .select()
      .from(franchiseUsers)
      .where(eq(franchiseUsers.id, payload.userId as number))
      .limit(1);

    if (users.length === 0 || !users[0].isActive) return c.json(null);

    const user = users[0];
    const franchiseData = await db
      .select()
      .from(franchises)
      .where(eq(franchises.id, user.franchiseId))
      .limit(1);

    return c.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      franchiseId: user.franchiseId,
      franchise: franchiseData[0] || null,
    });
  } catch {
    return c.json(null);
  }
});

// Importar rutas de backup
import backupApp from "./backup";

// Endpoint para verificar/crear tablas - SOLO crea si no existen, NUNCA borra
// Requiere token secreto para prevenir acceso no autorizado
app.get("/api/init-tables", async (c) => {
  try {
    // Validar token secreto
    const providedToken = c.req.query("token");
    const expectedToken = process.env.INIT_TABLES_SECRET;
    if (expectedToken && providedToken !== expectedToken) {
      return c.json({ error: "Acceso denegado" }, 403);
    }

    const connection = await mysql.createConnection(env.databaseUrl);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS franchises (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        displayName VARCHAR(255) NOT NULL,
        code VARCHAR(20) NOT NULL UNIQUE,
        isWarehouse TINYINT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS franchise_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        franchiseId INT NOT NULL,
        username VARCHAR(100) NOT NULL UNIQUE,
        passwordHash VARCHAR(255) NOT NULL,
        displayName VARCHAR(255) NOT NULL,
        role ENUM('staff','admin') DEFAULT 'staff',
        isActive TINYINT DEFAULT 1,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS shipments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        trackingNumber VARCHAR(50) NOT NULL UNIQUE,
        invoiceNumber VARCHAR(50),
        senderName VARCHAR(255) NOT NULL,
        senderPhone VARCHAR(50) NOT NULL,
        originFranchiseId INT NOT NULL,
        destinationFranchiseId INT NOT NULL,
        currentLocationId INT NOT NULL,
        status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','EN_RUTA','EN_PARADA','CANCELADO') DEFAULT 'CREADO',
        receiverName VARCHAR(255),
        notes TEXT,
        createdBy INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS shipment_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shipmentId INT NOT NULL,
        description VARCHAR(500) NOT NULL,
        quantity INT DEFAULT 1,
        details VARCHAR(500),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS shipment_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shipmentId INT NOT NULL,
        status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','EN_RUTA','EN_PARADA','CANCELADO') NOT NULL,
        locationId INT NOT NULL,
        notes TEXT,
        createdBy INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS delivery_routes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        status ENUM('PLANIFICADA','EN_RUTA','COMPLETADA','CANCELADA') DEFAULT 'PLANIFICADA',
        createdBy INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS route_stops (
        id INT AUTO_INCREMENT PRIMARY KEY,
        routeId INT NOT NULL,
        cityName VARCHAR(100) NOT NULL,
        stopOrder INT DEFAULT 1,
        status ENUM('PENDIENTE','LLEGADO','COMPLETADO') DEFAULT 'PENDIENTE',
        arrivalTime TIMESTAMP NULL,
        departureTime TIMESTAMP NULL,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS route_shipments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        routeId INT NOT NULL,
        stopId INT NOT NULL,
        shipmentId INT NOT NULL,
        status ENUM('ASIGNADO','ENTREGADO','NO_RECOGIDO') DEFAULT 'ASIGNADO',
        deliveredAt TIMESTAMP NULL,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.end();
    return c.json({ success: true, message: "All tables verified/created! No data was deleted." });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ─── REPAIR USERS endpoint: Recreates any missing franchise users ───
app.get("/api/repair-users", async (c) => {
  try {
    // Validate secret token
    const providedToken = c.req.query("token");
    const expectedToken = process.env.INIT_TABLES_SECRET;
    if (expectedToken && providedToken !== expectedToken) {
      return c.json({ error: "Acceso denegado" }, 403);
    }

    const db = getDb();
    const results: Array<{ action: string; code: string; details: string }> = [];

    // Repair login users (only for stores, NOT pickup points)
    for (const f of loginFranchiseData) {
      try {
        const existingFranchise = await db.select().from(franchises).where(eq(franchises.code, f.code)).limit(1);
        let franchiseId: number;

        if (existingFranchise.length === 0) {
          const result = await db.insert(franchises).values(f);
          franchiseId = Number(result[0].insertId);
          results.push({ action: "created_franchise", code: f.code, details: f.displayName });
        } else {
          franchiseId = existingFranchise[0].id;
        }

        const existingUser = await db.select().from(franchiseUsers).where(eq(franchiseUsers.username, f.code)).limit(1);
        if (existingUser.length === 0) {
          await db.insert(franchiseUsers).values({
            franchiseId,
            username: f.code,
            passwordHash: hashPassword("american2025"),
            displayName: f.displayName,
            role: f.isWarehouse ? "admin" : "staff",
            isActive: 1,
          });
          results.push({ action: "created_user", code: f.code, details: f.displayName });
        } else {
          // Update password to ensure it's correct
          await db.update(franchiseUsers)
            .set({ passwordHash: hashPassword("american2025"), isActive: 1 })
            .where(eq(franchiseUsers.id, existingUser[0].id));
          results.push({ action: "updated_password", code: f.code, details: f.displayName });
        }
      } catch (e: any) {
        results.push({ action: "error", code: f.code, details: e.message });
      }
    }

    // Repair driver user
    try {
      const bodegaFranchise = await db.select().from(franchises).where(eq(franchises.code, "bodega")).limit(1);
      if (bodegaFranchise.length > 0) {
        const existingDriver = await db.select().from(franchiseUsers).where(eq(franchiseUsers.username, "chofer")).limit(1);
        if (existingDriver.length === 0) {
          await db.insert(franchiseUsers).values({
            franchiseId: bodegaFranchise[0].id,
            username: "chofer",
            passwordHash: hashPassword("american2025"),
            displayName: "Chofer - Rutas",
            role: "admin",
            isActive: 1,
          });
          results.push({ action: "created_user", code: "chofer", details: "Chofer - Rutas" });
        } else {
          await db.update(franchiseUsers)
            .set({ passwordHash: hashPassword("american2025"), isActive: 1 })
            .where(eq(franchiseUsers.id, existingDriver[0].id));
          results.push({ action: "updated_password", code: "chofer", details: "Chofer - Rutas" });
        }
      }
    } catch (e: any) {
      results.push({ action: "error", code: "chofer", details: e.message });
    }

    return c.json({ success: true, repaired: results.length, details: results });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ─── DEBUG: List all users (diagnostic only) ───
app.get("/api/debug/users", async (c) => {
  try {
    // Validate secret token
    const providedToken = c.req.query("token");
    const expectedToken = process.env.INIT_TABLES_SECRET;
    if (expectedToken && providedToken !== expectedToken) {
      return c.json({ error: "Acceso denegado" }, 403);
    }

    const db = getDb();
    const allUsers = await db.select({
      id: franchiseUsers.id,
      username: franchiseUsers.username,
      displayName: franchiseUsers.displayName,
      franchiseId: franchiseUsers.franchiseId,
      role: franchiseUsers.role,
      isActive: franchiseUsers.isActive,
      passwordHashPrefix: franchiseUsers.passwordHash,
    }).from(franchiseUsers);

    const allFranchises = await db.select().from(franchises);

    return c.json({
      users: allUsers.map(u => ({
        ...u,
        passwordHashPrefix: u.passwordHashPrefix ? u.passwordHashPrefix.substring(0, 16) + "..." : null,
      })),
      franchises: allFranchises,
      expectedUsers: franchiseData.map(f => f.code),
      hashTest: {
        password: "american2025",
        hash: hashPassword("american2025"),
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── REPAIR: Fix shipment_tracking ENUM to include EN_RUTA and EN_PARADA ───
app.get("/api/fix-tracking-table", async (c) => {
  try {
    const providedToken = c.req.query("token");
    const expectedToken = process.env.INIT_TABLES_SECRET;
    if (expectedToken && providedToken !== expectedToken) {
      return c.json({ error: "Acceso denegado" }, 403);
    }

    const connection = await mysql.createConnection(env.databaseUrl);
    await connection.execute(`
      ALTER TABLE shipment_tracking 
      MODIFY status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','EN_RUTA','EN_PARADA','CANCELADO') NOT NULL
    `);
    await connection.end();

    return c.json({ success: true, message: "Tabla shipment_tracking actualizada con EN_RUTA y EN_PARADA" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ─── REPAIR: Fix EN_RUTA tracking for a specific route ───
app.get("/api/fix-route-tracking", async (c) => {
  try {
    const providedToken = c.req.query("token");
    const expectedToken = process.env.INIT_TABLES_SECRET;
    if (expectedToken && providedToken !== expectedToken) {
      return c.json({ error: "Acceso denegado" }, 403);
    }

    const routeId = parseInt(c.req.query("routeId") || "0");
    if (!routeId) return c.json({ error: "routeId requerido" }, 400);

    const db = getDb();

    // Get bodega user ID (franchise code "bodega")
    const bodegaFranchise = await db.select().from(franchises).where(eq(franchises.code, "bodega")).limit(1);
    if (bodegaFranchise.length === 0) return c.json({ error: "Bodega not found" }, 500);

    const bodegaUser = await db.select().from(franchiseUsers).where(eq(franchiseUsers.franchiseId, bodegaFranchise[0].id)).limit(1);
    const bodegaUserId = bodegaUser.length > 0 ? bodegaUser[0].id : 1;

    const results: Array<{ shipmentId: number; action: string }> = [];

    // Get stops for this route
    const stops = await db.select().from(routeStops).where(eq(routeStops.routeId, routeId));
    for (const stop of stops) {
      const assigned = await db.select().from(routeShipments).where(eq(routeShipments.stopId, stop.id));
      for (const rs of assigned) {
        // Check if EN_RUTA tracking exists
        const existing = await db.select().from(shipmentTracking)
          .where(eq(shipmentTracking.shipmentId, rs.shipmentId));
        const hasEnRuta = existing.some(t => t.status === "EN_RUTA");

        if (!hasEnRuta) {
          try {
            // Use raw SQL to get better error details
            const connection = await mysql.createConnection(env.databaseUrl);
            await connection.execute(
              `INSERT INTO shipment_tracking (shipmentId, status, locationId, notes, createdBy) VALUES (?, 'EN_RUTA', 0, ?, ?)`,
              [rs.shipmentId, `Asignado a ruta - en ruta hacia ${stop.cityName}`, bodegaUserId]
            );
            await connection.end();
            await db.update(shipments).set({ status: "EN_RUTA" }).where(eq(shipments.id, rs.shipmentId));
            results.push({ shipmentId: rs.shipmentId, action: "created_EN_RUTA" });
          } catch (insertErr: any) {
            results.push({ shipmentId: rs.shipmentId, action: "error: " + insertErr.message });
          }
        }
      }
    }

    return c.json({
      success: true,
      routeId,
      fixed: results.length,
      message: results.length > 0 ? `Reparados ${results.length} envios` : "Nada que reparar",
      details: results,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ─── FIX: Fix shipments table ENUM to include EN_RUTA and EN_PARADA ───
app.get("/api/fix-shipments-table", async (c) => {
  try {
    const providedToken = c.req.query("token");
    const expectedToken = process.env.INIT_TABLES_SECRET;
    if (expectedToken && providedToken !== expectedToken) {
      return c.json({ error: "Acceso denegado" }, 403);
    }

    const connection = await mysql.createConnection(env.databaseUrl);
    await connection.execute(`
      ALTER TABLE shipments 
      MODIFY status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','EN_RUTA','EN_PARADA','CANCELADO') NOT NULL
    `);
    await connection.end();

    return c.json({ success: true, message: "Tabla shipments actualizada con EN_RUTA y EN_PARADA" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ─── FIX: Force update shipment status to EN_RUTA for route shipments ───
app.get("/api/fix-shipment-status", async (c) => {
  try {
    const providedToken = c.req.query("token");
    const expectedToken = process.env.INIT_TABLES_SECRET;
    if (expectedToken && providedToken !== expectedToken) {
      return c.json({ error: "Acceso denegado" }, 403);
    }

    const routeId = parseInt(c.req.query("routeId") || "0");
    if (!routeId) return c.json({ error: "routeId requerido" }, 400);

    const db = getDb();
    const results: Array<{ shipmentId: number; trackingNumber: string; oldStatus: string; newStatus: string }> = [];

    // Get stops for this route
    const stops = await db.select().from(routeStops).where(eq(routeStops.routeId, routeId));
    for (const stop of stops) {
      const assigned = await db.select().from(routeShipments).where(eq(routeShipments.stopId, stop.id));
      for (const rs of assigned) {
        const shipmentData = await db.select().from(shipments).where(eq(shipments.id, rs.shipmentId)).limit(1);
        if (shipmentData.length === 0) continue;
        
        const oldStatus = shipmentData[0].status;
        
        // Force update to EN_RUTA regardless of current status
        if (oldStatus !== "EN_RUTA" && oldStatus !== "EN_PARADA" && oldStatus !== "RECIBIDO_EN_DESTINO") {
          await db.update(shipments).set({ status: "EN_RUTA" }).where(eq(shipments.id, rs.shipmentId));
          results.push({
            shipmentId: rs.shipmentId,
            trackingNumber: shipmentData[0].trackingNumber,
            oldStatus,
            newStatus: "EN_RUTA",
          });
        }
      }
    }

    return c.json({
      success: true,
      routeId,
      fixed: results.length,
      message: results.length > 0 ? `Actualizados ${results.length} envios a EN_RUTA` : "Nada que actualizar",
      details: results,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ─── DIAGNOSTIC: Show full route state with shipment details ───
app.get("/api/debug/route-state", async (c) => {
  try {
    const providedToken = c.req.query("token");
    const expectedToken = process.env.INIT_TABLES_SECRET;
    if (expectedToken && providedToken !== expectedToken) {
      return c.json({ error: "Acceso denegado" }, 403);
    }

    const routeId = parseInt(c.req.query("routeId") || "0");
    if (!routeId) return c.json({ error: "routeId requerido" }, 400);

    const db = getDb();

    // 1. Get route
    const route = await db.select().from(deliveryRoutes).where(eq(deliveryRoutes.id, routeId)).limit(1);

    // 2. Get stops
    const stops = await db.select().from(routeStops).where(eq(routeStops.routeId, routeId));

    // 3. For each stop, get shipments and their tracking
    const stopsWithShipments = [];
    for (const stop of stops) {
      const assigned = await db.select().from(routeShipments).where(eq(routeShipments.stopId, stop.id));
      const shipmentsWithTracking = [];
      for (const rs of assigned) {
        const shipmentData = await db.select().from(shipments).where(eq(shipments.id, rs.shipmentId)).limit(1);
        const tracking = await db.select().from(shipmentTracking).where(eq(shipmentTracking.shipmentId, rs.shipmentId));
        shipmentsWithTracking.push({
          routeShipmentId: rs.id,
          shipmentId: rs.shipmentId,
          trackingNumber: shipmentData[0]?.trackingNumber || "?",
          status: shipmentData[0]?.status || "?",
          hasEnRutaTracking: tracking.some(t => t.status === "EN_RUTA"),
          hasEnParadaTracking: tracking.some(t => t.status === "EN_PARADA"),
          allTracking: tracking.map(t => ({ status: t.status, notes: t.notes })),
        });
      }
      stopsWithShipments.push({
        stopId: stop.id,
        cityName: stop.cityName,
        status: stop.status,
        shipments: shipmentsWithTracking,
      });
    }

    return c.json({
      route: route[0] || null,
      stops: stopsWithShipments,
      summary: {
        totalStops: stops.length,
        totalShipments: stopsWithShipments.reduce((sum, s) => sum + s.shipments.length, 0),
        shipmentsWithEnRuta: stopsWithShipments.reduce((sum, s) => sum + s.shipments.filter(sh => sh.hasEnRutaTracking).length, 0),
        shipmentsWithoutEnRuta: stopsWithShipments.reduce((sum, s) => sum + s.shipments.filter(sh => !sh.hasEnRutaTracking).length, 0),
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message, stack: err.stack }, 500);
  }
});

// ─── REPAIR: Clean up shipments wrongly assigned to routes ───
// Debug: Ver datos completos de un envio por tracking number
app.get("/api/debug/track-raw", async (c) => {
  try {
    const providedToken = c.req.query("token");
    const expectedToken = process.env.INIT_TABLES_SECRET;
    if (expectedToken && providedToken !== expectedToken) {
      return c.json({ error: "Acceso denegado" }, 403);
    }

    const db = getDb();
    const trackingNumber = c.req.query("trackingNumber");
    if (!trackingNumber) return c.json({ error: "trackingNumber requerido" }, 400);

    const shipment = await db.select().from(shipments).where(eq(shipments.trackingNumber, trackingNumber)).limit(1);
    if (shipment.length === 0) return c.json({ error: "No encontrado" }, 404);

    const allFranchises = await db.select().from(franchises);
    const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));
    const destFranchise = franchiseMap.get(shipment[0].destinationFranchiseId);

    const pickupCodes = ["grecia", "san_ramon", "palmares"];
    const isPickupRoute = pickupCodes.includes(destFranchise?.code?.toLowerCase() || "") ||
                          (destFranchise?.displayName?.toLowerCase() || "").includes("recogida");

    return c.json({
      trackingNumber,
      destinationFranchiseId: shipment[0].destinationFranchiseId,
      destinationCode: destFranchise?.code,
      destinationName: destFranchise?.displayName,
      isPickupRoute,
      pickupCodes,
      status: shipment[0].status,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Debug: Ver estados reales de un envio
app.get("/api/debug/shipment-tracking", async (c) => {
  try {
    const providedToken = c.req.query("token");
    const expectedToken = process.env.INIT_TABLES_SECRET;
    if (expectedToken && providedToken !== expectedToken) {
      return c.json({ error: "Acceso denegado" }, 403);
    }

    const db = getDb();
    const trackingId = c.req.query("id");

    // Get all tracking entries with shipment info
    let query;
    if (trackingId) {
      query = db.select().from(shipmentTracking).where(eq(shipmentTracking.shipmentId, parseInt(trackingId)));
    } else {
      query = db.select().from(shipmentTracking);
    }

    const entries = await query;
    const allShipments = await db.select().from(shipments);
    const allFranchises = await db.select().from(franchises);
    const shipmentMap = new Map(allShipments.map(s => [s.id, s]));
    const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

    const enriched = entries.map(e => {
      const s = shipmentMap.get(e.shipmentId);
      return {
        id: e.id,
        shipmentId: e.shipmentId,
        trackingNumber: s?.trackingNumber || "?",
        status: e.status,
        destination: s ? franchiseMap.get(s.destinationFranchiseId)?.displayName || "?" : "?",
        destinationId: s?.destinationFranchiseId,
        isPickup: s ? (franchiseMap.get(s.destinationFranchiseId)?.displayName?.toLowerCase().includes("recogida") || false) : false,
        notes: e.notes,
        createdAt: e.createdAt,
      };
    });

    // Filter only EN_RUTA and EN_PARADA
    const routeEntries = enriched.filter(e => e.status === "EN_RUTA" || e.status === "EN_PARADA");

    return c.json({
      total: entries.length,
      routeRelated: routeEntries.length,
      allStatuses: [...new Set(entries.map(e => e.status))],
      routeEntries: routeEntries,
      pickupFranchises: allFranchises.filter(f => f.displayName?.toLowerCase().includes("recogida")).map(f => ({ id: f.id, name: f.displayName })),
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Limpia envios a tiendas normales que tienen tracking EN_RUTA o EN_PARADA
app.get("/api/repair-route-shipments", async (c) => {
  try {
    const providedToken = c.req.query("token");
    const expectedToken = process.env.INIT_TABLES_SECRET;
    if (expectedToken && providedToken !== expectedToken) {
      return c.json({ error: "Acceso denegado" }, 403);
    }

    const db = getDb();
    const connection = await mysql.createConnection(env.databaseUrl);
    const results: Array<{ action: string; trackingNumber: string; details: string }> = [];

    // 1. Get pickup franchise IDs
    const allFranchises = await db.select().from(franchises);
    const pickupIds = allFranchises
      .filter(f => f.displayName?.toLowerCase().includes("recogida"))
      .map(f => f.id);

    if (pickupIds.length === 0) {
      await connection.end();
      return c.json({ success: true, message: "No hay puntos de recogida", fixed: 0, details: [] });
    }

    // 2. Find all EN_RUTA/EN_PARADA tracking for non-pickup shipments using raw SQL
    const pickupList = pickupIds.join(",");
    const [rows] = await connection.execute(`
      SELECT st.id, st.shipmentId, st.status, s.trackingNumber, f.displayName as destination
      FROM shipment_tracking st
      JOIN shipments s ON s.id = st.shipmentId
      JOIN franchises f ON f.id = s.destinationFranchiseId
      WHERE st.status IN ('EN_RUTA', 'EN_PARADA')
        AND s.destinationFranchiseId NOT IN (${pickupList})
    `);

    const badEntries = rows as any[];

    if (badEntries.length === 0) {
      await connection.end();
      return c.json({ success: true, message: "No se encontraron registros huérfanos", fixed: 0, details: [] });
    }

    // 3. Delete them
    for (const entry of badEntries) {
      await db.delete(shipmentTracking).where(eq(shipmentTracking.id, entry.id));
      results.push({
        action: "deleted_" + entry.status,
        trackingNumber: entry.trackingNumber,
        details: `Eliminado ${entry.status} de envio a ${entry.destination}`
      });
    }

    await connection.end();

    return c.json({
      success: true,
      message: `Eliminados ${badEntries.length} registros huérfanos (EN_RUTA/EN_PARADA)`,
      fixed: badEntries.length,
      details: results,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ─── FIX: Recreate national_shipments table with correct schema ───
app.get("/api/fix-national-table", async (c) => {
  try {
    const providedToken = c.req.query("token");
    const expectedToken = process.env.INIT_TABLES_SECRET;
    if (expectedToken && providedToken !== expectedToken) {
      return c.json({ error: "Acceso denegado" }, 403);
    }

    const connection = await mysql.createConnection(env.databaseUrl);

    await connection.execute("DROP TABLE IF EXISTS national_shipments");

    await connection.execute(`
      CREATE TABLE national_shipments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        franchiseId BIGINT UNSIGNED NOT NULL,
        receiverName VARCHAR(255) NOT NULL,
        receiverPhone VARCHAR(50) NOT NULL,
        province VARCHAR(50) NOT NULL,
        canton VARCHAR(50) NOT NULL,
        district VARCHAR(50) NOT NULL,
        deliveryAddress TEXT NOT NULL,
        description VARCHAR(255) NOT NULL,
        notes TEXT,
        packageSize ENUM("PEQUENO","MEDIANO","GRANDE") NOT NULL,
        paymentMethod ENUM("PAGA_ORIGEN","COBRA_DESTINO") NOT NULL,
        createdBy BIGINT UNSIGNED NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await connection.end();
    return c.json({ success: true, message: "Tabla national_shipments recreada correctamente" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.route("/api/backup", backupApp);
app.get(Paths.oauthCallback, createOAuthCallbackHandler());
app.all("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  // Create tables and seed data
  await initTables();
  await runSeed();

  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`[server] Running on http://localhost:${port}/`);
  });
}
