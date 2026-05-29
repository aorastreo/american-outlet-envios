import { createHash } from "crypto";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

function hashPassword(password) {
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

async function seed() {
  console.log("Seeding franchises...");
  
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Create tables if not exist
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS franchises (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      code VARCHAR(255) NOT NULL UNIQUE,
      is_warehouse TINYINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS franchise_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      franchise_id INT NOT NULL,
      username VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'staff',
      is_active TINYINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const f of franchiseData) {
    const [existing] = await connection.execute(
      "SELECT id FROM franchises WHERE code = ?",
      [f.code]
    );
    
    if (existing.length === 0) {
      const [result] = await connection.execute(
        "INSERT INTO franchises (name, display_name, code, is_warehouse) VALUES (?, ?, ?, ?)",
        [f.name, f.displayName, f.code, f.isWarehouse]
      );
      
      const franchiseId = result.insertId;
      
      await connection.execute(
        "INSERT INTO franchise_users (franchise_id, username, password_hash, display_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?)",
        [franchiseId, f.code, hashPassword("american2025"), f.displayName, f.isWarehouse ? "admin" : "staff", 1]
      );
      
      console.log(`Created: ${f.displayName} (user: ${f.code} / pass: american2025)`);
    } else {
      console.log(`Already exists: ${f.displayName}`);
    }
  }
  
  // Create shipments table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS shipments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tracking_number VARCHAR(255) NOT NULL UNIQUE,
      origin_id INT NOT NULL,
      destination_id INT NOT NULL,
      sender_name VARCHAR(255),
      sender_phone VARCHAR(50),
      receiver_name VARCHAR(255),
      status VARCHAR(50) DEFAULT 'CREADO',
      notes TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS shipment_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shipment_id INT NOT NULL,
      description VARCHAR(500) NOT NULL,
      quantity INT DEFAULT 1
    )
  `);
  
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS shipment_tracking (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shipment_id INT NOT NULL,
      status VARCHAR(50) NOT NULL,
      notes TEXT,
      actor_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await connection.end();
  console.log("Seed complete!");
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
