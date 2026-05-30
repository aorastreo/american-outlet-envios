import { Hono } from "hono";
import { exec } from "child_process";
import { promisify } from "util";
import { env } from "./lib/env";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

const backupApp = new Hono();

backupApp.post("/api/backup", async (c) => {
  try {
    const dbUrl = env.databaseUrl;
    if (!dbUrl) {
      return c.json({ error: "DATABASE_URL not configured" }, 500);
    }

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

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const command = `mysqldump -h ${host} -P ${port} -u ${user} -p'${password}' ${database} > ${filepath}`;
    await execAsync(command);

    const stats = fs.statSync(filepath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    return c.json({
      success: true,
      message: "Backup creado exitosamente",
      filename,
      sizeMB: `${sizeMB} MB`,
      path: filepath,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[backup] Error:", error.message);
    return c.json({ error: "Error al crear backup", details: error.message }, 500);
  }
});

backupApp.get("/api/backup", async (c) => {
  try {
    const backupDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      return c.json({ backups: [] });
    }

    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith(".sql"))
      .map(f => {
        const stats = fs.statSync(path.join(backupDir, f));
        return {
          filename: f,
          sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
          created: stats.mtime,
        };
      })
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    return c.json({ backups: files });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default backupApp;
