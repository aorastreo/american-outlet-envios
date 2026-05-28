import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  tinyint,
} from "drizzle-orm/mysql-core";

// ─── Users (OAuth) ───────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Franchises ──────────────────────────────────────────────────
export const franchises = mysqlTable("franchises", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  isWarehouse: tinyint("isWarehouse").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Franchise = typeof franchises.$inferSelect;
export type InsertFranchise = typeof franchises.$inferInsert;

// ─── Franchise Users (local auth) ────────────────────────────────
export const franchiseUsers = mysqlTable("franchise_users", {
  id: serial("id").primaryKey(),
  franchiseId: bigint("franchiseId", { mode: "number", unsigned: true }).notNull(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["staff", "admin"]).default("staff").notNull(),
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FranchiseUser = typeof franchiseUsers.$inferSelect;
export type InsertFranchiseUser = typeof franchiseUsers.$inferInsert;

// ─── Shipments ───────────────────────────────────────────────────
export const shipments = mysqlTable("shipments", {
  id: serial("id").primaryKey(),
  trackingNumber: varchar("trackingNumber", { length: 50 }).notNull().unique(),
  invoiceNumber: varchar("invoiceNumber", { length: 50 }),
  senderName: varchar("senderName", { length: 255 }).notNull(),
  senderPhone: varchar("senderPhone", { length: 50 }).notNull(),
  originFranchiseId: bigint("originFranchiseId", { mode: "number", unsigned: true }).notNull(),
  destinationFranchiseId: bigint("destinationFranchiseId", { mode: "number", unsigned: true }).notNull(),
  currentLocationId: bigint("currentLocationId", { mode: "number", unsigned: true }).notNull(),
  status: mysqlEnum("status", [
    "CREADO",
    "ENVIADO_A_BODEGA",
    "RECIBIDO_EN_BODEGA",
    "ENVIADO_A_DESTINO",
    "RECIBIDO_EN_DESTINO",
    "CANCELADO",
  ]).notNull(),
  receiverName: varchar("receiverName", { length: 255 }),
  notes: text("notes"),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = typeof shipments.$inferInsert;

// ─── Shipment Items ──────────────────────────────────────────────
export const shipmentItems = mysqlTable("shipment_items", {
  id: serial("id").primaryKey(),
  shipmentId: bigint("shipmentId", { mode: "number", unsigned: true }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShipmentItem = typeof shipmentItems.$inferSelect;
export type InsertShipmentItem = typeof shipmentItems.$inferInsert;

// ─── Shipment Tracking History ───────────────────────────────────
export const shipmentTracking = mysqlTable("shipment_tracking", {
  id: serial("id").primaryKey(),
  shipmentId: bigint("shipmentId", { mode: "number", unsigned: true }).notNull(),
  status: mysqlEnum("status", [
    "CREADO",
    "ENVIADO_A_BODEGA",
    "RECIBIDO_EN_BODEGA",
    "ENVIADO_A_DESTINO",
    "RECIBIDO_EN_DESTINO",
    "CANCELADO",
  ]).notNull(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }).notNull(),
  notes: varchar("notes", { length: 500 }),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShipmentTracking = typeof shipmentTracking.$inferSelect;
export type InsertShipmentTracking = typeof shipmentTracking.$inferInsert;
