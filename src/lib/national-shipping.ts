const LEGACY_COST: Record<string, number> = {
  PEQUENO: 1000,
  MEDIANO: 3500,
  GRANDE: 6500,
};

/** Prefer stored fee; fall back to old size-based prices for older rows. */
export function nationalShippingFee(shipment: {
  shippingFee?: number | null;
  packageSize?: string | null;
}): number {
  if (typeof shipment.shippingFee === "number" && Number.isFinite(shipment.shippingFee)) {
    return Math.max(0, Math.round(shipment.shippingFee));
  }
  return LEGACY_COST[shipment.packageSize || ""] || 0;
}

export function formatNationalFee(amount: number): string {
  if (amount <= 0) return "Gratuita";
  return `¢${amount.toLocaleString("es-CR")}`;
}
