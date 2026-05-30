import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[init] DATABASE_URL is not set");
  process.exit(1);
}

async function init() {
  console.log("[init] Creating tables...");
  const connection = await mysql.createConnection(DATABASE_URL);

  await connection.execute("DROP TABLE IF EXISTS shipment_tracking");
  await connection.execute("DROP TABLE IF EXISTS shipment_items");
  await connection.execute("DROP TABLE IF EXISTS shipments");
  await connection.execute("DROP TABLE IF EXISTS franchise_users");
  await connection.execute("DROP TABLE IF EXISTS franchises");

  await connection.execute(`
    CREATE TABLE franchises (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      displayName VARCHAR(255) NOT NULL,
      code VARCHAR(20) NOT NULL UNIQUE,
      isWarehouse TINYINT DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.execute(`
    CREATE TABLE franchise_users (
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
    CREATE TABLE shipments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      trackingNumber VARCHAR(50) NOT NULL UNIQUE,
      invoiceNumber VARCHAR(50),
      senderName VARCHAR(255) NOT NULL,
      senderPhone VARCHAR(50) NOT NULL,
      originFranchiseId INT NOT NULL,
      destinationFranchiseId INT NOT NULL,
      currentLocationId INT NOT NULL,
      status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','CANCELADO') DEFAULT 'CREADO',
      receiverName VARCHAR(255),
      notes TEXT,
      createdBy INT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await connection.execute(`
    CREATE TABLE shipment_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shipmentId INT NOT NULL,
      description VARCHAR(500) NOT NULL,
      quantity INT DEFAULT 1,
      details VARCHAR(500),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.execute(`
    CREATE TABLE shipment_tracking (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shipmentId INT NOT NULL,
      status ENUM('CREADO','ENVIADO_A_BODEGA','RECIBIDO_EN_BODEGA','ENVIADO_A_DESTINO','RECIBIDO_EN_DESTINO','CANCELADO') NOT NULL,
      notes TEXT,
      actorName VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.end();
  console.log("[init] Tables created successfully!");
}

init().catch(err => {
  console.error("[init] Failed:", err.message);
  process.exit(1);
});
