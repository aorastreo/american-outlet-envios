import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[init] DATABASE_URL is not set");
  process.exit(1);
}

async function init() {
  console.log("[init] Creating tables if not exist...");
  const connection = await mysql.createConnection(DATABASE_URL);

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

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS shipments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tracking_number VARCHAR(255) NOT NULL UNIQUE,
      invoice_number VARCHAR(50),
      sender_name VARCHAR(255) NOT NULL,
      sender_phone VARCHAR(50) NOT NULL,
      origin_franchise_id INT NOT NULL,
      destination_franchise_id INT NOT NULL,
      current_location_id INT NOT NULL,
      status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','CANCELADO') DEFAULT 'CREADO',
      receiver_name VARCHAR(255),
      notes TEXT,
      created_by INT NOT NULL,
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
  console.log("[init] Tables created successfully!");
}

init().catch(err => {
  console.error("[init] Failed:", err.message);
  process.exit(1);
});
