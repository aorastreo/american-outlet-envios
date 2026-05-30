import { Hono } from "hono";
import { env } from "./lib/env";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

const backupApp = new Hono();

backupApp.post("/api/backup", async (c) => {
  try {
    const dbUrl = env.databaseUrl;
    if (!dbUrl) {
      return c.json({ error: "DATABASE_URL not configured" }, 500);
    }

    const connection = await mysql.createConnection(dbUrl);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-railway-${timestamp}.sql`;
    const backupDir = path.join(process.cwd(), "backups");
    const filepath = path.join(backupDir, filename);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const [tables] = await connection.execute("SHOW TABLES");
    let sql = `-- Backup American Outlet - ${new Date().toISOString()}\n`;
    sql += `-- Database: railway\n\n`;

    for (const tableRow of tables as any[]) {
      const tableName = Object.values(tableRow)[0] as string;

      const [createTable] = await connection.execute(`SHOW CREATE TABLE \`${tableName}\``);
      sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      sql += (createTable as any[])[0]["Create Table"] + ";\n\n";

      const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
      if ((rows as any[]).length > 0) {
        const columns = Object.keys((rows as any[])[0]);
        sql += `INSERT INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(", ")}) VALUES\n`;

        const values = (rows as any[]).map(row => {
          return "(" + columns.map(col => {
            const val = (row as any)[col];
            if (val === null) return "NULL";
            return "'" + String(val).replace(/'/g, "''") + "'";
          }).join(", ") + ")";
        }).join(",\n");

        sql += values + ";\n\n";
      }
    }

    fs.writeFileSync(filepath, sql);
    await connection.end();

    const stats = fs.statSync(filepath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    return c.json({
      success: true,
      message: "Backup creado exitosamente",
      filename,
      sizeMB: `${sizeMB} MB`,
      tables: (tables as any[]).length,
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
