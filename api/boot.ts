import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import { getDb } from "./queries/connection";
import { franchises, franchiseUsers } from "@db/schema";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import mysql from "mysql2/promise";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

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

    for (const f of franchiseData) {
      const existing = await db
        .select()
        .from(franchises)
        .where(eq(franchises.code, f.code));

      if (existing.length === 0) {
        const result = await db.insert(franchises).values(f);
        const franchiseId = Number(result[0].insertId);

        await db.insert(franchiseUsers).values({
          franchiseId,
          username: f.code,
          passwordHash: hashPassword("american2025"),
          displayName: f.displayName,
          role: f.isWarehouse ? "admin" : "staff",
          isActive: 1,
        });

        console.log(`[seed] Created: ${f.displayName} (user: ${f.code} / pass: american2025)`);
      } else {
        console.log(`[seed] Already exists: ${f.displayName}`);
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

    // ─── AUTO-SEED: Ensure all franchises and users exist ───
    console.log("[login] Running auto-seed...");
    for (const f of franchiseData) {
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

    // Repair all franchise users
    for (const f of franchiseData) {
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
