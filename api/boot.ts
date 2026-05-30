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
        status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','CANCELADO') DEFAULT 'CREADO',
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
        status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','CANCELADO') NOT NULL,
        locationId INT NOT NULL,
        notes TEXT,
        createdBy INT NOT NULL,
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

    console.log("[seed] Seed complete!");
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
    const { username, password } = body;

    if (!username || !password) {
      return c.json({ error: "Usuario y contraseña requeridos" }, 400);
    }

    const db = getDb();

    // Auto-seed: if no users exist, create all franchises and users
    const allUsers = await db.select().from(franchiseUsers).limit(1);
    if (allUsers.length === 0) {
      console.log("[login] Auto-seeding franchises...");
      for (const f of franchiseData) {
        try {
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
          console.log(`[login] Auto-created: ${f.displayName}`);
        } catch (e: any) {
          console.log(`[login] Skip ${f.code}: ${e.message}`);
        }
      }
    }

    const users = await db
      .select()
      .from(franchiseUsers)
      .where(eq(franchiseUsers.username, username))
      .limit(1);

    if (users.length === 0) {
      return c.json({ error: "Usuario o contraseña incorrectos" }, 401);
    }

    const user = users[0];
    if (user.passwordHash !== hashPassword(password)) {
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
    console.error("[login] Error:", err.message);
    return c.json({ error: "Error del servidor: " + err.message }, 500);
  }
});

// REST endpoint for current user
app.get("/api/auth/me", async (c) => {
  try {
    const cookieHeader = c.req.header("cookie") || "";
    const match = cookieHeader.match(/franchise_sid=([^;]+)/);
    if (!match) return c.json(null);

    // Simple token verification would go here
    // For now return null to trigger login
    return c.json(null);
  } catch {
    return c.json(null);
  }
});

// Endpoint para inicializar tablas manualmente - DEBE ir antes de app.all("/api/*")
app.get("/api/init-tables", async (c) => {
  try {
    const connection = await mysql.createConnection(env.databaseUrl);
    
    await connection.execute(`DROP TABLE IF EXISTS shipment_tracking`);
    await connection.execute(`DROP TABLE IF EXISTS shipment_items`);
    await connection.execute(`DROP TABLE IF EXISTS shipments`);
    await connection.execute(`DROP TABLE IF EXISTS franchise_users`);
    await connection.execute(`DROP TABLE IF EXISTS franchises`);

    await connection.execute(`
      CREATE TABLE franchises (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        displayName VARCHAR(255) NOT NULL,
        code VARCHAR(20) NOT NULL UNIQUE,
        isWarehouse TINYINT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE franchise_users (
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
      CREATE TABLE shipments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        trackingNumber VARCHAR(50) NOT NULL UNIQUE,
        invoiceNumber VARCHAR(50),
        senderName VARCHAR(255) NOT NULL,
        senderPhone VARCHAR(50) NOT NULL,
        originFranchiseId INT NOT NULL,
        destinationFranchiseId INT NOT NULL,
        currentLocationId INT NOT NULL,
        status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','CANCELADO') DEFAULT 'CREADO',
        receiverName VARCHAR(255),
        notes TEXT,
        createdBy INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE shipment_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shipmentId INT NOT NULL,
        description VARCHAR(500) NOT NULL,
        quantity INT DEFAULT 1,
        details VARCHAR(500),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE shipment_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shipmentId INT NOT NULL,
        status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','CANCELADO') NOT NULL,
        locationId INT NOT NULL,
        notes TEXT,
        createdBy INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.end();
    return c.json({ success: true, message: "Tables created!" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
// Backup endpoint
app.post("/api/backup", async (c) => {
  try {
    const { execSync } = require("child_process");
    const fs = require("fs");
    const path = require("path");
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return c.json({ error: "DATABASE_URL not configured" }, 500);
    
    const url = new URL(dbUrl);
    const host = url.hostname;
    const port = url.port || "3306";
    const user = url.username;
    const password = decodeURIComponent(url.password);
    const database = url.pathname.replace("/", "");
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${database}-${timestamp}.sql`;
    const backupDir = path.join(process.cwd(), "backups");
    const filepath = path.join(backupDir, filename);
    
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    
    const command = `mysqldump -h ${host} -P ${port} -u ${user} -p'${password}' ${database} > ${filepath}`;
    execSync(command);
    
    const stats = fs.statSync(filepath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    return c.json({ success: true, filename, sizeMB: `${sizeMB} MB` });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
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
    console.log(`Server running on http://localhost:${port}/`);
  });
}
