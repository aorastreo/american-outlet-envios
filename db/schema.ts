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
  warehouseLocation: varchar("warehouseLocation", { length: 50 }),
  status: mysqlEnum("status", [
    "CREADO",
    "ENVIADO_A_BODEGA",
    "RECIBIDO_EN_BODEGA",
    "ENVIADO_A_DESTINO",
    "RECIBIDO_EN_DESTINO",
    "EN_RUTA",
    "EN_PARADA",
    "NO_RECOGIDO",
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
    "EN_RUTA",
    "EN_PARADA",
    "NO_RECOGIDO",
    "CANCELADO",
  ]).notNull(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }).notNull(),
  notes: varchar("notes", { length: 500 }),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShipmentTracking = typeof shipmentTracking.$inferSelect;
export type InsertShipmentTracking = typeof shipmentTracking.$inferInsert;

// ─── Delivery Routes ────────────────────────────────────────────
export const deliveryRoutes = mysqlTable("delivery_routes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["PLANIFICADA", "EN_RUTA", "COMPLETADA", "CANCELADA"]).default("PLANIFICADA").notNull(),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type DeliveryRoute = typeof deliveryRoutes.$inferSelect;
export type InsertDeliveryRoute = typeof deliveryRoutes.$inferInsert;

// ─── Route Stops ────────────────────────────────────────────────
export const routeStops = mysqlTable("route_stops", {
  id: serial("id").primaryKey(),
  routeId: bigint("routeId", { mode: "number", unsigned: true }).notNull(),
  cityName: varchar("cityName", { length: 100 }).notNull(),
  stopOrder: int("stopOrder").default(1).notNull(),
  status: mysqlEnum("status", ["PENDIENTE", "LLEGADO", "COMPLETADO"]).default("PENDIENTE").notNull(),
  arrivalTime: timestamp("arrivalTime"),
  departureTime: timestamp("departureTime"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RouteStop = typeof routeStops.$inferSelect;
export type InsertRouteStop = typeof routeStops.$inferInsert;

// ─── Route Shipments ────────────────────────────────────────────
export const routeShipments = mysqlTable("route_shipments", {
  id: serial("id").primaryKey(),
  routeId: bigint("routeId", { mode: "number", unsigned: true }).notNull(),
  stopId: bigint("stopId", { mode: "number", unsigned: true }).notNull(),
  shipmentId: bigint("shipmentId", { mode: "number", unsigned: true }).notNull(),
  status: mysqlEnum("status", ["ASIGNADO", "ENTREGADO", "NO_RECOGIDO"]).default("ASIGNADO").notNull(),
  deliveredAt: timestamp("deliveredAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RouteShipment = typeof routeShipments.$inferSelect;
export type InsertRouteShipment = typeof routeShipments.$inferInsert;

// ─── National Shipments ─────────────────────────────────────────
export const nationalShipments = mysqlTable("national_shipments", {
  id: serial("id").primaryKey(),
  franchiseId: bigint("franchiseId", { mode: "number", unsigned: true }).notNull(),
  receiverName: varchar("receiverName", { length: 255 }).notNull(),
  receiverPhone: varchar("receiverPhone", { length: 50 }).notNull(),
  province: varchar("province", { length: 50 }).notNull(),
  canton: varchar("canton", { length: 50 }).notNull(),
  district: varchar("district", { length: 50 }).notNull(),
  deliveryAddress: text("deliveryAddress").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 50 }),
  notes: text("notes"),
  packageSize: mysqlEnum("packageSize", ["PEQUENO", "MEDIANO", "GRANDE"]).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["PAGA_ORIGEN", "COBRA_DESTINO"]).notNull(),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type NationalShipment = typeof nationalShipments.$inferSelect;
export type InsertNationalShipment = typeof nationalShipments.$inferInsert;
