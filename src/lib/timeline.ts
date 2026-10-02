import type { Shipment } from "../../api/shipment-router";

export interface TimelineStep {
  status: string;
  label: string;
  desc: string;
}

/**
 * Determine current step index using tracking history to disambiguate duplicate statuses.
 * Counts how many times each status has occurred in history + current status.
 * Walks through steps forward, matching occurrences until we reach the current state.
 */
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
  // Current status is the latest state (may not be in history yet if just changed)
  statusCounts[mappedStatus] = (statusCounts[mappedStatus] || 0) + 1;

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
    steps = [
      { status: "CREADO", label: "Creado", desc: originName ? `En ${originName}` : "Envio registrado" },
    ];
    if (!isSameBodega) {
      const destBodega = destName || "Bodega Destino";
      steps.push({ status: "ENVIADO_A_BODEGA", label: `Enviado a ${destBodega}`, desc: "Bodega envia a bodega destino" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${destBodega}`, desc: "Listo para retiro en bodega" });
    } else {
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: `En ${originName || "Bodega"}`, desc: "Listo para retiro en bodega" });
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

    if (destIsSabana) {
      const firstIsCedi = firstBodegaName.toLowerCase().includes("cedi");
      if (!firstIsCedi) {
        steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a CEDI", desc: "Bodega envia a bodega" });
        steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En CEDI", desc: "Bodega recibio" });
      }
      steps.push({ status: "ENVIADO_A_DESTINO", label: `Enviado a Bodega Sabana`, desc: "Bodega envia a bodega destino" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: `En Bodega Sabana`, desc: "Listo para retiro en bodega" });
    } else if (firstBodegaName !== destBodegaName) {
      steps.push({ status: "ENVIADO_A_DESTINO", label: `Enviado a ${destBodegaName}`, desc: "Bodega envia a bodega destino" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: `En ${destBodegaName}`, desc: "Listo para retiro en bodega" });
    }
  }
  // --- BODEGA → TIENDA ---
  else if (originIsWarehouse) {
    steps.push({ status: "CREADO", label: "Creado", desc: originName ? `En ${originName}` : "Envio registrado" });
    if (originIsCedi && destIsMio) {
      steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a Bodega Pavon", desc: "Enviado a bodega" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En Bodega Pavon", desc: "Bodega recibio" });
    } else if (originIsPavon && destIsVendedor) {
      steps.push({ status: "ENVIADO_A_BODEGA", label: "Enviado a CEDI", desc: "Enviado a bodega" });
      steps.push({ status: "RECIBIDO_EN_BODEGA", label: "En CEDI", desc: "Bodega recibio" });
    }
    if (isPickup) {
      steps.push({ status: "EN_RUTA", label: "En Ruta", desc: "Asignado a camion" });
      steps.push({ status: "EN_PARADA", label: "En Parada", desc: "Camion en punto" });
      steps.push({ status: "RECIBIDO_EN_DESTINO", label: "Entregado", desc: "Cliente recibio" });
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
    steps.push({ status: "EN_RUTA", label: "En Ruta", desc: "Asignado a camion" });
    steps.push({ status: "EN_PARADA", label: "En Parada", desc: "Camion en punto" });
    steps.push({ status: "RECIBIDO_EN_DESTINO", label: "Entregado", desc: "Cliente recibio" });
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
