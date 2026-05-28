import { relations } from "drizzle-orm";
import {
  franchises,
  franchiseUsers,
  shipments,
  shipmentItems,
  shipmentTracking,
} from "./schema";

export const franchisesRelations = relations(franchises, ({ many }) => ({
  users: many(franchiseUsers),
  outgoingShipments: many(shipments, { relationName: "originFranchise" }),
  incomingShipments: many(shipments, { relationName: "destinationFranchise" }),
  currentShipments: many(shipments, { relationName: "currentLocation" }),
}));

export const franchiseUsersRelations = relations(franchiseUsers, ({ one }) => ({
  franchise: one(franchises, {
    fields: [franchiseUsers.franchiseId],
    references: [franchises.id],
  }),
}));

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  originFranchise: one(franchises, {
    fields: [shipments.originFranchiseId],
    references: [franchises.id],
    relationName: "originFranchise",
  }),
  destinationFranchise: one(franchises, {
    fields: [shipments.destinationFranchiseId],
    references: [franchises.id],
    relationName: "destinationFranchise",
  }),
  currentLocation: one(franchises, {
    fields: [shipments.currentLocationId],
    references: [franchises.id],
    relationName: "currentLocation",
  }),
  items: many(shipmentItems),
  trackingHistory: many(shipmentTracking),
}));

export const shipmentItemsRelations = relations(shipmentItems, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentItems.shipmentId],
    references: [shipments.id],
  }),
}));

export const shipmentTrackingRelations = relations(shipmentTracking, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentTracking.shipmentId],
    references: [shipments.id],
  }),
  location: one(franchises, {
    fields: [shipmentTracking.locationId],
    references: [franchises.id],
  }),
}));
