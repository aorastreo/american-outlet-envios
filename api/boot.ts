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

async function createFranchiseToken(userId: number): Promise<string> {
  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || "american-outlet-dev-key-change-in-prod");
  return new SignJWT({ userId, type: "franchise" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
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
    const cookie = await import("cookie");
    const cookieOptions = {
      httpOnly: true,
      path: "/",
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60,
    };
    c.header("Set-Cookie", cookie.serialize("franchise_sid", token, cookieOptions));

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
cd ~/Documents/american-outlet-envios && git add api/boot.ts && git commit -m "Fix REST login: create JWT cookie for franchise auth" && git push origin main --force
cat > ~/Documents/american-outlet-envios/api/boot.ts << 'ENDOFFILE'
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

async function createFranchiseToken(userId: number): Promise<string> {
  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || "american-outlet-dev-key-change-in-prod");
  return new SignJWT({ userId, type: "franchise" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
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
    const cookieOptions = {
      httpOnly: true,
      path: "/",
      sameSite: "lax" as const,
      secure: false,
      maxAge: 7 * 24 * 60 * 60,
    };
    const cookie = await import("cookie");
    c.header("Set-Cookie", cookie.serialize("franchise_sid", token, cookieOptions), { append: true });

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
  await runSeed();

  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
