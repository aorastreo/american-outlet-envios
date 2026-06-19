import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
} from "drizzle-orm/mysql-core";

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
  notes: text("notes"),
  packageSize: mysqlEnum("packageSize", ["PEQUENO", "MEDIANO", "GRANDE"]).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["PAGA_ORIGEN", "COBRA_DESTINO"]).notNull(),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type NationalShipment = typeof nationalShipments.$inferSelect;
export type InsertNationalShipment = typeof nationalShipments.$inferInsert;
