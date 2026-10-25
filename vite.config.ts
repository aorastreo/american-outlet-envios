import path from "path"
import { fileURLToPath } from "url"
import react from "@vitejs/plugin-react"
import { defineConfig, type PluginOption } from "vite"

const rootDir = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(async ({ command }) => {
  const plugins: PluginOption[] = [react()]

  // These plugins only exist for local development. Loading them during
  // `vite build` makes Vercel fail if the dev packages are unavailable.
  if (command === "serve") {
    const [{ default: devServer }, { inspectAttr }] = await Promise.all([
      import("@hono/vite-dev-server"),
      import("kimi-plugin-inspect-react"),
    ])
    plugins.unshift(
      devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }),
      inspectAttr(),
    )
  }

  return {
    plugins,
    server: {
      port: 3000,
    },
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "./src"),
        "@contracts": path.resolve(rootDir, "./contracts"),
        "@db": path.resolve(rootDir, "./db"),
        "db": path.resolve(rootDir, "./db"),
      },
    },
    envDir: rootDir,
    build: {
      outDir: path.resolve(rootDir, "dist/public"),
      emptyOutDir: true,
    },
  }
})
