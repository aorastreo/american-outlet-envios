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

function stopName(name: string | null | undefined): string {
  return (name || "").replace(/^Recogida\s*-\s*/i, "").trim();
}

export function shipmentPlaceText(shipment: {
  status: string;
  originName?: string | null;
  destinationName?: string | null;
  warehouseLocation?: string | null;
}): { badge: string | null; chip: string | null } {
  const place = shipment.warehouseLocation?.trim() || "";
  const destination = stopName(shipment.destinationName);
  const firstStop = getFranchiseGroup(shipment.originName) === "vendedor" ? "Bodega Cedi" : "Bodega Pavon";

  if (shipment.status === "CREADO") {
    return { badge: null, chip: place ? `Sale primero a ${place}` : null };
  }

  if (shipment.status === "ENVIADO_A_BODEGA") {
    if (!place) return { badge: null, chip: null };
    if (place === firstStop) return { badge: null, chip: `En camino a ${place}` };
    return {
      badge: place.toLowerCase().includes("cedi") ? "En camino a CEDI" : `En camino a ${place}`,
      chip: null,
    };
  }

  if (shipment.status === "RECIBIDO_EN_BODEGA") {
    return { badge: place ? `En ${place}` : null, chip: null };
  }

  if (shipment.status === "RECIBIDO_EN_DESTINO" && destination.toLowerCase().includes("bodega")) {
    return { badge: "Entregado al cliente", chip: null };
  }

  if (shipment.status === "RECIBIDO_EN_DESTINO" && getFranchiseGroup(shipment.destinationName) === "route" && destination) {
    return { badge: `Entregado en ${destination}`, chip: null };
  }

  if (shipment.status === "ENVIADO_A_DESTINO") {
    return { badge: destination ? `En camino a ${destination}` : "En camino a la tienda", chip: null };
  }

  if (shipment.status === "EN_RUTA") {
    return { badge: destination ? `En ruta a ${destination}` : "En ruta", chip: null };
  }

  if (shipment.status === "NO_RECOGIDO") {
    return { badge: destination ? `No recogido en ${destination}` : "No recogido", chip: null };
  }

  if (shipment.status === "EN_PARADA") {
    return { badge: destination ? `En el punto de ${destination}` : null, chip: null };
  }

  return { badge: null, chip: null };
}

export function historyStepLabel(status: string, notes: string | null | undefined, fallback: string): string {
  const note = (notes || "").trim();
  const place = (pattern: RegExp) =>
    (note.match(pattern)?.[1] || "")
      .replace(/\s*\(\d+\s+envios en lote\)\s*$/i, "")
      .trim()
      .replace(/\s+/g, " ");

  if (status === "ENVIADO_A_BODEGA") {
    const to = place(/hacia\s+(.+)$/i) || place(/Enviado a\s+(.+?)(?:\s+por|\s+desde|$)/i);
    if (to) return `En camino a ${to}`;
  }
  if (status === "RECIBIDO_EN_BODEGA") {
    const at = place(/Recibido en\s+(.+)$/i);
    if (at) return `En ${at}`;
  }
  if (status === "ENVIADO_A_DESTINO") {
    const to = place(/hacia\s+(.+)$/i);
    if (to) return `En camino a ${to}`;
    if (/sabana/i.test(note)) return "En camino a Bodega Sabana";
  }
  if (status === "RECIBIDO_EN_DESTINO") {
    const deliveredAt = place(/Entregado al cliente en\s+(.+)$/i)
      .replace(/\s+-.*/, "")
      .replace(/^Recogida\s*-\s*/i, "");
    if (deliveredAt && !/^bodega$/i.test(deliveredAt)) {
      return getFranchiseGroup(deliveredAt) === "route"
        ? `Entregado en ${deliveredAt}`
        : `Entregado al cliente en ${deliveredAt}`;
    }
    if (/cliente/i.test(note)) return "Entregado al cliente";
    const at = place(/Recibido en\s+(.+)$/i);
    if (at && !/^tienda/i.test(at)) return `En ${at}`;
  }
  if (status === "EN_RUTA") {
    const to = place(/hacia\s+(.+)$/i).replace(/^Recogida\s*-\s*/i, "");
    if (to) return `En ruta a ${to}`;
  }
  if (status === "EN_PARADA") {
    const to = place(/lleg[oó] a\s+(.+?)(?:\s+-|$)/i).replace(/^Recogida\s*-\s*/i, "");
    if (to) return `En el punto de ${to}`;
  }
  if (status === "NO_RECOGIDO") {
    const at = place(/No recogido en\s+(.+)$/i).replace(/^Recogida\s*-\s*/i, "");
    if (at) return `No recogido en ${at}`;
    return "No recogido";
  }
  return fallback;
}
