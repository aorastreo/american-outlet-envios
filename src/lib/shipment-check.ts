export type CheckableShipment = {
  id: number;
  trackingNumber: string;
  invoiceNumber?: string | null;
  senderName?: string | null;
  originName?: string | null;
  destinationName?: string | null;
  items?: { description: string; quantity: number; details?: string | null }[] | null;
};

export type CodeMatch<T> =
  | { status: "empty" }
  | { status: "none" }
  | { status: "many"; shipments: T[] }
  | { status: "one"; shipment: T };

function compact(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, "").toUpperCase();
}

export function matchShipmentCode<T extends CheckableShipment>(code: string, shipments: T[]): CodeMatch<T> {
  const needle = compact(code);
  if (needle.length < 3) return { status: "empty" };

  const hits = shipments.filter((shipment) => {
    const tracking = compact(shipment.trackingNumber);
    const invoice = compact(shipment.invoiceNumber);
    if (tracking === needle || (invoice && invoice === needle)) return true;
    if (needle.length >= 4 && (tracking.endsWith(needle) || (invoice && invoice.endsWith(needle)))) return true;
    return false;
  });

  if (hits.length === 0) return { status: "none" };
  if (hits.length > 1) return { status: "many", shipments: hits };
  return { status: "one", shipment: hits[0] };
}
