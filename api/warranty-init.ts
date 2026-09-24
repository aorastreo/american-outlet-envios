// Script to initialize warranty tables if they don't exist
import { sql } from "drizzle-orm";
import { getDb } from "./queries/connection";

export async function initWarrantyTables() {
  const db = getDb();
  try {
    // Check if warranties table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS warranties (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        trackingNumber VARCHAR(50) NOT NULL UNIQUE,
        invoiceNumber VARCHAR(50) NOT NULL,
        senderName VARCHAR(255) NOT NULL,
        senderPhone VARCHAR(50) NOT NULL,
        productDescription VARCHAR(255) NOT NULL,
        defectDescription TEXT NOT NULL,
        originFranchiseId BIGINT UNSIGNED NOT NULL,
        currentLocationId BIGINT UNSIGNED NOT NULL,
        status ENUM('CREADA', 'ENVIADO_A_CEDI', 'RECIBIDO_EN_CEDI', 'EN_REPARACION', 'REPARADO', 'ENVIADO_A_TIENDA', 'RECIBIDO_EN_TIENDA', 'ENTREGADO_AL_CLIENTE') DEFAULT 'CREADA' NOT NULL,
        notes TEXT,
        createdBy BIGINT UNSIGNED NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS warranty_tracking (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        warrantyId BIGINT UNSIGNED NOT NULL,
        status VARCHAR(50) NOT NULL,
        locationId BIGINT UNSIGNED NOT NULL,
        notes TEXT,
        createdBy BIGINT UNSIGNED NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    
    console.log("[initWarrantyTables] Tables created successfully");
    return true;
  } catch (error) {
    console.error("[initWarrantyTables] Error:", error);
    return false;
  }
}
