import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  // 1) Serve static assets with correct MIME types
  app.use("/assets/*", serveStatic({ root: "./dist/public" }));
  app.use("/*.ico", serveStatic({ root: "./dist/public" }));
  app.use("/*.png", serveStatic({ root: "./dist/public" }));
  app.use("/*.jpg", serveStatic({ root: "./dist/public" }));
  app.use("/*.jpeg", serveStatic({ root: "./dist/public" }));
  app.use("/*.svg", serveStatic({ root: "./dist/public" }));
  app.use("/*.txt", serveStatic({ root: "./dist/public" }));
  app.use("/*.webmanifest", serveStatic({ root: "./dist/public" }));

  // 2) SPA fallback: all non-API, non-asset routes -> index.html
  app.use("*", (c) => {
    const pathname = new URL(c.req.url).pathname;

    // Let API routes 404 naturally (handled by api/boot.ts)
    if (pathname.startsWith("/api/") || pathname.startsWith("/trpc/")) {
      return c.json({ error: "Not Found" }, 404);
    }

    // Serve index.html for all browser routes (SPA)
    const indexPath = path.resolve(distPath, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");
    return c.html(content);
  });
}
