export type FranchiseGroup = "mio" | "vendedor" | "route" | "warehouse" | "sabana" | "unknown";

export function getFranchiseGroup(name: string | undefined | null): FranchiseGroup {
  if (!name) return "unknown";
  const n = name.toLowerCase();
  if (n.includes("sabana")) return "sabana";
  if (n.includes("grecia") || n.includes("palmares") || n.includes("san ramon")) return "route";
  if (n.includes("pavon") && n.includes("bodega")) return "mio";
  if (n.includes("cedi") && n.includes("bodega")) return "vendedor";
  if (n.includes("chiles") || n.includes("pavon") || n.includes("santa rosa") || n.includes("ganga")) return "mio";
  if (n.includes("boca arenal") || n.includes("florencia") || n.includes("fortuna") || n.includes("quesada") || n.includes("puerto viejo")) return "vendedor";
  if (n.includes("cedi")) return "vendedor";
  if (n.includes("bodega")) return "warehouse";
  return "unknown";
}

export function needsInterBodega(shipment: {
  originName?: string | null;
  destinationName?: string | null;
  warehouseLocation?: string | null;
}): { needsTransfer: boolean; targetBodega: string } {
  const originGroup = getFranchiseGroup(shipment.originName);
  const destGroup = getFranchiseGroup(shipment.destinationName);
  const currentWh = shipment.warehouseLocation;

  if (destGroup === "sabana" || destGroup === "route") {
    if (currentWh === "Bodega Cedi") return { needsTransfer: false, targetBodega: "" };
    return { needsTransfer: true, targetBodega: "Bodega Cedi" };
  }

  if (originGroup === destGroup) return { needsTransfer: false, targetBodega: "" };

  if (originGroup === "mio" && destGroup === "vendedor") {
    if (currentWh === "Bodega Cedi") return { needsTransfer: false, targetBodega: "" };
    return { needsTransfer: true, targetBodega: "Bodega Cedi" };
  }

  if (originGroup === "vendedor" && destGroup === "mio") {
    if (currentWh === "Bodega Pavon") return { needsTransfer: false, targetBodega: "" };
    return { needsTransfer: true, targetBodega: "Bodega Pavon" };
  }

  return { needsTransfer: false, targetBodega: "" };
}

export function mixedShipmentMoveMessage(
  shipments: Array<{
    originName?: string | null;
    destinationName?: string | null;
    warehouseLocation?: string | null;
  }>,
): string | null {
  if (shipments.length < 2) return null;

  const moves = shipments.map((shipment) => needsInterBodega(shipment));
  const directCount = moves.filter((move) => !move.needsTransfer).length;
  const targets = [...new Set(moves.filter((move) => move.needsTransfer).map((move) => move.targetBodega))];

  if (directCount > 0 && targets.length > 0) {
    const transferCount = moves.length - directCount;
    return `No se pueden enviar juntos. ${directCount} van directo a la tienda y ${transferCount} deben seguir a ${targets.join(" o ")}. Sepáralos.`;
  }

  if (targets.length > 1) {
    return `No se pueden enviar juntos. Unos siguen a ${targets[0]} y otros a ${targets[1]}. Sepáralos.`;
  }

  return null;
}
