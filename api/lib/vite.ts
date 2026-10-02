import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    c.header("Pragma", "no-cache");
    c.header("Expires", "0");
    await next();
  });

  app.use("*", serveStatic({ root: "./dist/public" }));

  app.notFound((c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    const indexPath = path.resolve(distPath, "index.html");
    let content = fs.readFileSync(indexPath, "utf-8");

    // INJECT: visible build marker + timeline fallback
    const injectScript = `<script>
window.__AO_BUILD__ = "v3.3-injected-${Date.now()}";
console.log("[AO] Backend-injected build:", window.__AO_BUILD__);
// Fallback timeline disambiguation for duplicate statuses
window.__AO_TIMELINE_FIX__ = true;
</script>`;

    content = content.replace("<head>", `<head>\n${injectScript}`);

    return c.html(content);
  });
}
