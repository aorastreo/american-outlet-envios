import { Hono } from "hono";
import mysql from "mysql2/promise";
import { env } from "./lib/env";

const app = new Hono();

app.post("/api/init-tables", async (c) => {
  try {
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
        status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','EN_RUTA','EN_PARADA','CANCELADO') DEFAULT 'CREADO',
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
        status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','EN_RUTA','EN_PARADA','CANCELADO') NOT NULL,
        locationId INT NOT NULL,
        notes TEXT,
        actorName VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.end();
    return c.json({ success: true, message: "Tables created!" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default app;
