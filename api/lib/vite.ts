import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  // Serve static assets (JS, CSS, images, etc.)
  app.use("/assets/*", serveStatic({ root: "./dist/public" }));
  app.use("/*.ico", serveStatic({ root: "./dist/public" }));
  app.use("/*.png", serveStatic({ root: "./dist/public" }));
  app.use("/*.jpg", serveStatic({ root: "./dist/public" }));
  app.use("/*.jpeg", serveStatic({ root: "./dist/public" }));
  app.use("/*.svg", serveStatic({ root: "./dist/public" }));
  app.use("/*.txt", serveStatic({ root: "./dist/public" }));
  app.use("/*.webmanifest", serveStatic({ root: "./dist/public" }));

  // SPA fallback: for any route that is not an API route,
  // serve index.html so React Router can handle client-side routing.
  // This must be a GET handler so it runs AFTER API routes but catches
  // all browser navigation (e.g., /envios, /dashboard, /envios/123).
  app.get("*", (c) => {
    const pathname = new URL(c.req.url).pathname;
    // API routes should 404 (they are handled by api/boot.ts)
    if (pathname.startsWith("/api/")) {
      return c.json({ error: "Not Found" }, 404);
    }
    // Serve index.html for all browser routes
    const indexPath = path.resolve(distPath, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");
    return c.html(content);
  });
}
