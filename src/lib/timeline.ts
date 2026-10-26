import type { Shipment } from "../../api/shipment-router";

export interface TimelineStep {
  status: string;
  label: string;
  desc: string;
}

function pickupPlace(name?: string | null): string {
  return (name || "").replace(/AMERICAN OUTLET\s*/i, "").replace(/^Recogida\s*-\s*/i, "").trim();
}

/**
 * Determine current step index using tracking history to disambiguate duplicate statuses.
 * Counts how many times each status has occurred in history + current status.
 * Walks through steps forward, matching occurrences until we reach the current state.
 */
export function showClosedRouteOnTimeline(steps: TimelineStep[]): TimelineStep[] {
  return steps.map((step) => {
    if (step.status !== "EN_PARADA") return step;
    const city = step.label.replace(/^En el punto de\s+/i, "").trim();
    const named = /^en el punto de\s+/i.test(step.label) && Boolean(city);
    return {
      ...step,
      label: named ? `No recogido en ${city}` : "No recogido",
      desc: "El camion ya salio",
    };
  });
}

export function getCurrentStepIndex(
  displaySteps: TimelineStep[],
  mappedStatus: string | undefined | null,
  trackingHistory: any[],
): number {
  if (!mappedStatus || displaySteps.length === 0) return -1;

  // Count occurrences of each status in tracking history
  const statusCounts: Record<string, number> = {};
  for (const t of trackingHistory) {
    if (t.status) {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
    }
  }
  // Current status is the latest state — only count it if it's NOT already
  // the last entry in history (avoids double-counting when status hasn't changed)
  const lastHistoryStatus = trackingHistory.length > 0 
    ? trackingHistory[trackingHistory.length - 1].status 
    : null;
  if (lastHistoryStatus !== mappedStatus) {
    statusCounts[mappedStatus] = (statusCounts[mappedStatus] || 0) + 1;
  }

  // Walk forward through steps, consuming counts
  const remaining = { ...statusCounts };
  for (let i = 0; i < displaySteps.length; i++) {
    const stepStatus = displaySteps[i].status;
    if (remaining[stepStatus] && remaining[stepStatus] > 0) {
      remaining[stepStatus]--;
      // If we just consumed the last occurrence of the current status, this is our step
      if (stepStatus === mappedStatus && remaining[stepStatus] === 0) {
        return i;
      }
    }
  }

  // Fallback: reverse find (for cases without tracking history)
  const reversedIndex = [...displaySteps].reverse().findIndex((s) => s.status === mappedStatus);
  return reversedIndex >= 0 ? displaySteps.length - 1 - reversedIndex : -1;
}
/**
 * Build shipment timeline steps for display.
 * Shared between admin (ShipmentDetail) and public (Track) views.
 */
export function buildShipmentTimeline(
  isPickup: boolean,
  originIsWarehouse: boolean,
  destIsWarehouse: boolean,
  trackingHistory: any[],
  whLoc?: string | null,
  currentShipmentStatus?: string | null,
  originName?: string,
  destName?: string,
): TimelineStep[] {
  let steps: TimelineStep[] = [];

  const destNameLower = (destName || "").toLowerCase();
  const originNameLower = (originName || "").toLowerCase();
  const destIsCedi = destNameLower.includes("cedi");
  const destIsPavon = destNameLower.includes("pavon");
  const destIsSabana = destNameLower.includes("sabana");

  const originIsCedi = originNameLower.includes("cedi");
  const originIsPavon = originNameLower.includes("pavon");
  const originIsSabana = originNameLower.includes("sabana");
  const destIsMio = destNameLower.includes("chiles") || destNameLower.includes("pavon") || destNameLower.includes("santa rosa") || destNameLower.includes("ganga");
  const destIsVendedor = destNameLower.includes("boca arenal") || destNameLower.includes("florencia") || destNameLower.includes("fortuna") || destNameLower.includes("quesada") || destNameLower.includes("puerto viejo");

     // --- BODEGA → BODEGA ---
  if (originIsWarehouse && destIsWarehouse) {
    const originNameClean = (originName || "").toLowerCase().replace("bodega ", "").trim();
    const destNameClean = (destName || "").toLowerCase().replace("bodega ", "").trim();
    const isSameBodega = originNameClean === destNameClean && originNameClean !== "";
    const originIsCediClean = originNameClean.includes("cedi");
    const destIsCediClean = destNameClean.includes("cedi");
    steps = [
      { status: "CREADO", label: "Creado", desc: originName ? `En ${originName}` : "Envio registrado" },
    ];
    if (destIsSabana && !isSameBodega) {
      if (!originIsCediClean) {
        steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a CEDI", desc: "Bodega envia a bodega" });
        steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En CEDI", desc: "Bodega recibio" });
      }
      steps.push({ status: "ENVIADO_A_DESTINO", label: "En camino a Bodega Sabana", desc: "Va hacia Bodega Sabana" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "En Bodega Sabana", desc: "Sabana recibio el paquete" });
    } else if (isSameBodega) {
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${originName || "Bodega"}`, desc: "Listo para retiro en bodega" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "Entregado al cliente", desc: "El cliente recogio el paquete en bodega" });
    } else if (originIsCediClean || destIsCediClean) {
      const destBodega = destName || "Bodega Destino";
      steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${destBodega}`, desc: "Bodega envia a bodega destino" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${destBodega}`, desc: "Listo para retiro en bodega" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "Entregado al cliente", desc: `El cliente recogio el paquete en ${destBodega}` });
    } else {
      steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a Cedi", desc: "Bodega envia a bodega" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En Cedi", desc: "Bodega recibio" });
      const destBodega = destName || "Bodega Destino";
      steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${destBodega}`, desc: "Bodega envia a bodega destino" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${destBodega}`, desc: "Listo para retiro en bodega" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "Entregado al cliente", desc: `El cliente recogio el paquete en ${destBodega}` });
    }
  }
  // --- TIENDA → BODEGA ---
  else if (destIsWarehouse) {
    const originIsMioStore = originNameLower.includes("chiles") || originNameLower.includes("pavon") || originNameLower.includes("santa rosa") || originNameLower.includes("ganga");
    const originIsVendedorStore = originNameLower.includes("boca arenal") || originNameLower.includes("florencia") || originNameLower.includes("fortuna") || originNameLower.includes("quesada") || originNameLower.includes("puerto viejo");
    const firstBodegaName = originIsMioStore ? "Bodega Pavon" : originIsVendedorStore ? "CEDI" : "Bodega";
    const destBodegaName = destName || (destIsCedi ? "CEDI" : destIsPavon ? "Bodega Pavon" : destIsSabana ? "Bodega Sabana" : "Bodega");

    steps.push({ status: "CREADO", label: "Creado", desc: "Envio registrado" });
    steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${firstBodegaName}`, desc: "Tienda envia a bodega" });
    steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${firstBodegaName}`, desc: "Bodega recibio" });

    const sameWarehouse = firstBodegaName.toLowerCase().replace("bodega ", "").trim() === destBodegaName.toLowerCase().replace("bodega ", "").trim();
    if (destIsSabana) {
      const firstIsCedi = firstBodegaName.toLowerCase().includes("cedi");
      if (!firstIsCedi) {
        steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a CEDI", desc: "Bodega envia a bodega" });
        steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En CEDI", desc: "Bodega recibio" });
      }
      steps.push({ status: "ENVIADO_A_DESTINO", label: "En camino a Bodega Sabana", desc: "Va hacia Bodega Sabana" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "En Bodega Sabana", desc: "Sabana recibio el paquete" });
    } else if (!sameWarehouse) {
      steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${destBodegaName}`, desc: "Bodega envia a bodega destino" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${destBodegaName}`, desc: "Listo para retiro en bodega" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "Entregado al cliente", desc: `El cliente recogio el paquete en ${destBodegaName}` });
    } else {
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "Entregado al cliente", desc: `El cliente recogio el paquete en ${destBodegaName}` });
    }
  }
  // --- BODEGA → TIENDA ---
  else if (originIsWarehouse) {
  steps.push({ status: "CREADO", label: "Creado", desc: originName ? `En ${originName}` : "Envio registrado" });
  if (originIsPavon && !destIsMio) {
    // Desde Pavon hacia cualquier destino que NO sea del grupo Mio (vendedores, pickup, etc.): pasa por Cedi
    steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a CEDI", desc: "Enviado a bodega" });
    steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En CEDI", desc: "Bodega recibio" });
  } else if (originIsCedi && destIsMio) {
    // Desde Cedi hacia grupo Mio: pasa por Pavon
    steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a Bodega Pavon", desc: "Enviado a bodega" });
    steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En Bodega Pavon", desc: "Bodega recibio" });
  }
    if (isPickup) {
      const city = pickupPlace(destName);
      steps.push({ status: "EN_RUTA", label: city ? `En ruta a ${city}` : "En ruta", desc: "El camion va hacia el punto" });
      steps.push({ status: "EN_PARADA", label: city ? `En el punto de ${city}` : "En parada", desc: "El camion ya llego" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: city ? `Entregado en ${city}` : "Entregado", desc: "El cliente recogio el paquete" });
    } else {
      steps.push({ status: "ENVIADO_A_DESTINO", label: "Enviado a Destino", desc: destName ? `Enviado a ${destName}` : "Enviado a tienda" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "Entregado", desc: destName ? `${destName} recibio` : "Tienda recibio" });
    }
  }
  // --- TIENDA → RUTA (pickup) ---
  else if (isPickup) {
    const originIsMioStore = originNameLower.includes("chiles") || originNameLower.includes("pavon") || originNameLower.includes("santa rosa") || originNameLower.includes("ganga");
    const originIsVendedorStore = originNameLower.includes("boca arenal") || originNameLower.includes("florencia") || originNameLower.includes("fortuna") || originNameLower.includes("quesada") || originNameLower.includes("puerto viejo");
    const firstBodegaName = originIsMioStore ? "Bodega Pavon" : originIsVendedorStore ? "CEDI" : "Bodega";

    steps.push({ status: "CREADO", label: "Creado", desc: "Envio registrado" });
    steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${firstBodegaName}`, desc: "Tienda envia a bodega" });
    steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${firstBodegaName}`, desc: "Bodega recibio" });
    if (originIsMioStore) {
      steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a CEDI", desc: "Bodega envia a bodega" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En CEDI", desc: "Bodega recibio" });
    }
    const city = pickupPlace(destName);
    steps.push({ status: "EN_RUTA", label: city ? `En ruta a ${city}` : "En ruta", desc: "El camion va hacia el punto" });
    steps.push({ status: "EN_PARADA", label: city ? `En el punto de ${city}` : "En parada", desc: "El camion ya llego" });
    steps.push({ status: "RECIBIDO_EN_DESTINO", label: city ? `Entregado en ${city}` : "Entregado", desc: "El cliente recogio el paquete" });
  }
  // --- TIENDA → TIENDA ---
  else {
    const originIsMio = originNameLower.includes("chiles") || originNameLower.includes("pavon") || originNameLower.includes("santa rosa") || originNameLower.includes("ganga");
    const originIsVendedor = originNameLower.includes("boca arenal") || originNameLower.includes("florencia") || originNameLower.includes("fortuna") || originNameLower.includes("quesada") || originNameLower.includes("puerto viejo");
    const isCrossGroup = (originIsMio && destIsVendedor) || (originIsVendedor && destIsMio);
    const firstBodegaName = originIsMio ? "Bodega Pavon" : originIsVendedor ? "CEDI" : "Bodega";

    steps.push({ status: "CREADO", label: "Creado", desc: "Envio registrado" });
    steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${firstBodegaName}`, desc: "Tienda envia a bodega" });
    steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${firstBodegaName}`, desc: "Bodega recibio" });

    if (isCrossGroup) {
      const interBodega = originIsMio ? "CEDI" : "Bodega Pavon";
      steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${interBodega}`, desc: "Bodega envia a bodega" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${interBodega}`, desc: "Bodega recibio" });
    }

    steps.push({ status: "ENVIADO_A_DESTINO", label: "Enviado a Destino", desc: "Bodega envia a tienda" });
    steps.push({ status: "RECIBIDO_EN_DESTINO", label: "Entregado", desc: "Tienda recibio" });
  }

  const lastTrackingEntry = trackingHistory.length > 0 ? trackingHistory[trackingHistory.length - 1] : null;
  const hasNoRecogido = lastTrackingEntry?.status === "NO_RECOGIDO" || currentShipmentStatus === "NO_RECOGIDO";
  if (hasNoRecogido && steps.length > 0) {
    const note = String(lastTrackingEntry?.notes || "");
    const fromNote = (note.match(/No recogido en\s+(.+)$/i)?.[1] || "").replace(/^Recogida\s*-\s*/i, "").trim();
    const city = fromNote || pickupPlace(destName);
    steps[steps.length - 1] = {
      status: "NO_RECOGIDO",
      label: city ? `No recogido en ${city}` : "No recogido",
      desc: "El cliente no paso a retirar",
    };
  }

  return steps;
}

/**
 * Extract first and second bodega names from tracking history notes.
 */
export function extractBodegaNames(trackingHistory: any[]) {
  let firstBodega = "";
  let secondBodega = "";
  for (const t of trackingHistory) {
    if (t.status === "RECIBIDO_EN_BODEGA" && !firstBodega && t.notes) {
      const match = t.notes.match(/Recibido en (Bodega\s+\w+)/i);
      if (match) firstBodega = match[1];
    }
    if (t.status === "ENVIADO_A_BODEGA" && !firstBodega && t.notes) {
      const match = t.notes.match(/desde\s+(Bodega\s+\w+)/i);
      if (match) firstBodega = match[1];
    }
    if (t.status === "ENVIADO_A_BODEGA" && firstBodega && t.notes) {
      const match = t.notes.match(/hacia\s+(Bodega\s+\w+)/i);
      if (match && match[1] !== firstBodega) secondBodega = match[1];
    }
  }
  return { firstBodega, secondBodega };
}
