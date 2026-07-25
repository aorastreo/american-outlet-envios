import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  // Serve static files (js, css, images, etc.)
  app.use("/assets/*", serveStatic({ root: "./dist/public" }));
  app.use("/*.ico", serveStatic({ root: "./dist/public" }));
  app.use("/*.png", serveStatic({ root: "./dist/public" }));
  app.use("/*.jpg", serveStatic({ root: "./dist/public" }));
  app.use("/*.jpeg", serveStatic({ root: "./dist/public" }));
  app.use("/*.svg", serveStatic({ root: "./dist/public" }));
  app.use("/*.txt", serveStatic({ root: "./dist/public" }));

  // SPA fallback: serve index.html for all non-API routes
  app.use("*", (c, next) => {
    const pathname = new URL(c.req.url).pathname;
    // Skip API routes
    if (pathname.startsWith("/api/") || pathname.startsWith("/trpc/")) {
      return next();
    }
    // Try to serve the file directly
    const filePath = path.join(distPath, pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return serveStatic({ root: "./dist/public" })(c, next);
    }
    // Fallback to index.html for SPA routes
    const indexPath = path.resolve(distPath, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");
    return c.html(content);
  });
}
