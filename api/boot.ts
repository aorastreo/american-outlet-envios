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
