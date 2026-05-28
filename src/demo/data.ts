// ===== DEMO DATA & LOCAL STORAGE API =====
// All data persists in browser localStorage for the demo

const STORAGE_KEY = "ao_demo_data";
const AUTH_KEY = "ao_demo_auth";

export const FRANCHISES = [
  { id: 1, name: "los_chiles", displayName: "Los Chiles", code: "los_chiles", isWarehouse: 0 },
  { id: 2, name: "pavon", displayName: "Pavon", code: "pavon", isWarehouse: 0 },
  { id: 3, name: "santa_rosa", displayName: "Santa Rosa", code: "santa_rosa", isWarehouse: 0 },
  { id: 4, name: "boca_arenal", displayName: "Boca Arenal", code: "boca_arenal", isWarehouse: 0 },
  { id: 5, name: "florencia", displayName: "Florencia", code: "florencia", isWarehouse: 0 },
  { id: 6, name: "fortuna", displayName: "Fortuna", code: "fortuna", isWarehouse: 0 },
  { id: 7, name: "ciudad_quesada", displayName: "Ciudad Quesada", code: "ciudad_quesada", isWarehouse: 0 },
  { id: 8, name: "bodega", displayName: "Bodega Central", code: "bodega", isWarehouse: 1 },
];

export const FRANCHISE_USERS = [
  { id: 1, username: "los_chiles", displayName: "Usuario Los Chiles", franchiseId: 1, role: "staff" },
  { id: 2, username: "pavon", displayName: "Usuario Pavon", franchiseId: 2, role: "staff" },
  { id: 3, username: "santa_rosa", displayName: "Usuario Santa Rosa", franchiseId: 3, role: "staff" },
  { id: 4, username: "boca_arenal", displayName: "Usuario Boca Arenal", franchiseId: 4, role: "staff" },
  { id: 5, username: "florencia", displayName: "Usuario Florencia", franchiseId: 5, role: "staff" },
  { id: 6, username: "fortuna", displayName: "Usuario Fortuna", franchiseId: 6, role: "staff" },
  { id: 7, username: "ciudad_quesada", displayName: "Usuario Ciudad Quesada", franchiseId: 7, role: "staff" },
  { id: 8, username: "bodega", displayName: "Administrador Bodega", franchiseId: 8, role: "admin" },
];

export const DEFAULT_PASSWORD = "american2025";

export interface DemoShipment {
  id: number;
  trackingNumber: string;
  invoiceNumber: string | null;
  senderName: string;
  senderPhone: string;
  receiverName: string | null;
  originFranchiseId: number;
  destinationFranchiseId: number;
  currentLocationId: number;
  status: string;
  notes: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  items: { id: number; description: string; quantity: number; details: string | null }[];
  tracking: { id: number; status: string; notes: string | null; createdAt: string; actorName: string }[];
}

interface DemoData {
  shipments: DemoShipment[];
  nextId: number;
}

function getInitialData(): DemoData {
  const bodega = 8;
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();

  const shipments: DemoShipment[] = [
    // 6 envíos a Florencia - RECIBIDO_EN_BODEGA
    { id: 1, trackingNumber: "AO-0017-K9", invoiceNumber: "4521", senderName: "Maria Gonzalez", senderPhone: "8723-4512", receiverName: null, originFranchiseId: 1, destinationFranchiseId: 5, currentLocationId: bodega, status: "RECIBIDO_EN_BODEGA", notes: "", createdBy: 1, createdAt: twoDaysAgo, updatedAt: yesterday, items: [{ id: 1, description: "Zapatos deportivos", quantity: 2, details: "Talla 38-42" }, { id: 2, description: "Camisetas algodon", quantity: 5, details: "Colores variados" }], tracking: [{ id: 1, status: "CREADO", notes: "Envio creado", createdAt: twoDaysAgo, actorName: "Usuario Los Chiles" }, { id: 2, status: "ENVIADO_A_BODEGA", notes: "Enviado desde tienda", createdAt: twoDaysAgo, actorName: "Usuario Los Chiles" }, { id: 3, status: "RECIBIDO_EN_BODEGA", notes: "Recibido en bodega central", createdAt: yesterday, actorName: "Administrador Bodega" }] },
    { id: 2, trackingNumber: "AO-0018-M4", invoiceNumber: "4522", senderName: "Carlos Jimenez", senderPhone: "8341-2298", receiverName: null, originFranchiseId: 2, destinationFranchiseId: 5, currentLocationId: bodega, status: "RECIBIDO_EN_BODEGA", notes: "", createdBy: 2, createdAt: twoDaysAgo, updatedAt: yesterday, items: [{ id: 3, description: "Pantalones jeans", quantity: 3, details: "Talla 32-36" }], tracking: [{ id: 4, status: "CREADO", notes: "Envio creado", createdAt: twoDaysAgo, actorName: "Usuario Pavon" }, { id: 5, status: "ENVIADO_A_BODEGA", notes: "Enviado desde tienda", createdAt: twoDaysAgo, actorName: "Usuario Pavon" }, { id: 6, status: "RECIBIDO_EN_BODEGA", notes: "Recibido en bodega central", createdAt: yesterday, actorName: "Administrador Bodega" }] },
    { id: 3, trackingNumber: "AO-0019-P7", invoiceNumber: "4523", senderName: "Ana Morales", senderPhone: "8890-1123", receiverName: null, originFranchiseId: 3, destinationFranchiseId: 5, currentLocationId: bodega, status: "RECIBIDO_EN_BODEGA", notes: "Fragil", createdBy: 3, createdAt: twoDaysAgo, updatedAt: yesterday, items: [{ id: 4, description: "Vasos decorativos", quantity: 4, details: "Manejar con cuidado" }, { id: 5, description: "Cojines", quantity: 2, details: "Colores rojo y azul" }], tracking: [{ id: 7, status: "CREADO", notes: "Envio creado", createdAt: twoDaysAgo, actorName: "Usuario Santa Rosa" }, { id: 8, status: "ENVIADO_A_BODEGA", notes: "Enviado desde tienda", createdAt: twoDaysAgo, actorName: "Usuario Santa Rosa" }, { id: 9, status: "RECIBIDO_EN_BODEGA", notes: "Recibido en bodega central - Fragil", createdAt: yesterday, actorName: "Administrador Bodega" }] },
    { id: 4, trackingNumber: "AO-0020-R2", invoiceNumber: "4524", senderName: "Pedro Sanchez", senderPhone: "8456-7789", receiverName: null, originFranchiseId: 4, destinationFranchiseId: 5, currentLocationId: bodega, status: "RECIBIDO_EN_BODEGA", notes: "", createdBy: 4, createdAt: twoDaysAgo, updatedAt: yesterday, items: [{ id: 6, description: "Relojes pulsera", quantity: 6, details: "Modelos variados" }], tracking: [{ id: 10, status: "CREADO", notes: "Envio creado", createdAt: twoDaysAgo, actorName: "Usuario Boca Arenal" }, { id: 11, status: "ENVIADO_A_BODEGA", notes: "Enviado desde tienda", createdAt: twoDaysAgo, actorName: "Usuario Boca Arenal" }, { id: 12, status: "RECIBIDO_EN_BODEGA", notes: "Recibido en bodega central", createdAt: yesterday, actorName: "Administrador Bodega" }] },
    { id: 5, trackingNumber: "AO-0021-T5", invoiceNumber: "4525", senderName: "Lucia Fernandez", senderPhone: "8123-4567", receiverName: null, originFranchiseId: 7, destinationFranchiseId: 5, currentLocationId: bodega, status: "RECIBIDO_EN_BODEGA", notes: "", createdBy: 7, createdAt: twoDaysAgo, updatedAt: yesterday, items: [{ id: 7, description: "Bolsos de cuero", quantity: 2, details: "Negro y cafe" }, { id: 8, description: "Cinturones", quantity: 3, details: "Talla unica" }], tracking: [{ id: 13, status: "CREADO", notes: "Envio creado", createdAt: twoDaysAgo, actorName: "Usuario Ciudad Quesada" }, { id: 14, status: "ENVIADO_A_BODEGA", notes: "Enviado desde tienda", createdAt: twoDaysAgo, actorName: "Usuario Ciudad Quesada" }, { id: 15, status: "RECIBIDO_EN_BODEGA", notes: "Recibido en bodega central", createdAt: yesterday, actorName: "Administrador Bodega" }] },
    { id: 6, trackingNumber: "AO-0022-X8", invoiceNumber: "4526", senderName: "Jose Martinez", senderPhone: "8777-3344", receiverName: null, originFranchiseId: 1, destinationFranchiseId: 5, currentLocationId: bodega, status: "RECIBIDO_EN_BODEGA", notes: "", createdBy: 1, createdAt: yesterday, updatedAt: yesterday, items: [{ id: 9, description: "Gorras baseball", quantity: 8, details: "Varios colores" }], tracking: [{ id: 16, status: "CREADO", notes: "Envio creado", createdAt: yesterday, actorName: "Usuario Los Chiles" }, { id: 17, status: "ENVIADO_A_BODEGA", notes: "Enviado desde tienda", createdAt: yesterday, actorName: "Usuario Los Chiles" }, { id: 18, status: "RECIBIDO_EN_BODEGA", notes: "Recibido en bodega central", createdAt: yesterday, actorName: "Administrador Bodega" }] },

    // 1 envío a Pavon
    { id: 7, trackingNumber: "AO-0023-Z1", invoiceNumber: "4527", senderName: "Roberto Castro", senderPhone: "8654-3210", receiverName: null, originFranchiseId: 1, destinationFranchiseId: 2, currentLocationId: bodega, status: "RECIBIDO_EN_BODEGA", notes: "", createdBy: 1, createdAt: yesterday, updatedAt: yesterday, items: [{ id: 10, description: "Mochilas escolares", quantity: 4, details: "Modelos 2025" }], tracking: [{ id: 19, status: "CREADO", notes: "Envio creado", createdAt: yesterday, actorName: "Usuario Los Chiles" }, { id: 20, status: "ENVIADO_A_BODEGA", notes: "Enviado desde tienda", createdAt: yesterday, actorName: "Usuario Los Chiles" }, { id: 21, status: "RECIBIDO_EN_BODEGA", notes: "Recibido en bodega central", createdAt: yesterday, actorName: "Administrador Bodega" }] },

    // 1 envío a Fortuna
    { id: 8, trackingNumber: "AO-0024-B4", invoiceNumber: "4528", senderName: "Diana Rojas", senderPhone: "8901-2233", receiverName: null, originFranchiseId: 3, destinationFranchiseId: 6, currentLocationId: bodega, status: "RECIBIDO_EN_BODEGA", notes: "", createdBy: 3, createdAt: yesterday, updatedAt: yesterday, items: [{ id: 11, description: "Sandalias", quantity: 5, details: "Talla 36-40" }], tracking: [{ id: 22, status: "CREADO", notes: "Envio creado", createdAt: yesterday, actorName: "Usuario Santa Rosa" }, { id: 23, status: "ENVIADO_A_BODEGA", notes: "Enviado desde tienda", createdAt: yesterday, actorName: "Usuario Santa Rosa" }, { id: 24, status: "RECIBIDO_EN_BODEGA", notes: "Recibido en bodega central", createdAt: yesterday, actorName: "Administrador Bodega" }] },

    // 2 pendientes de recibir en bodega
    { id: 9, trackingNumber: "AO-0025-D7", invoiceNumber: "4529", senderName: "Eduardo Vargas", senderPhone: "8333-4455", receiverName: null, originFranchiseId: 2, destinationFranchiseId: 6, currentLocationId: 2, status: "ENVIADO_A_BODEGA", notes: "", createdBy: 2, createdAt: yesterday, updatedAt: yesterday, items: [{ id: 12, description: "Chaquetas impermeables", quantity: 3, details: "Talla M-XL" }], tracking: [{ id: 25, status: "CREADO", notes: "Envio creado", createdAt: yesterday, actorName: "Usuario Pavon" }, { id: 26, status: "ENVIADO_A_BODEGA", notes: "Enviado desde tienda a bodega", createdAt: yesterday, actorName: "Usuario Pavon" }] },
    { id: 10, trackingNumber: "AO-0026-F3", invoiceNumber: "4530", senderName: "Sofia Reyes", senderPhone: "8444-5566", receiverName: null, originFranchiseId: 1, destinationFranchiseId: 5, currentLocationId: 1, status: "ENVIADO_A_BODEGA", notes: "", createdBy: 1, createdAt: yesterday, updatedAt: yesterday, items: [{ id: 13, description: "Blusas floreadas", quantity: 6, details: "Talla S-L" }], tracking: [{ id: 27, status: "CREADO", notes: "Envio creado", createdAt: yesterday, actorName: "Usuario Los Chiles" }, { id: 28, status: "ENVIADO_A_BODEGA", notes: "Enviado desde tienda a bodega", createdAt: yesterday, actorName: "Usuario Los Chiles" }] },

    // 1 envío entregado
    { id: 11, trackingNumber: "AO-0027-H6", invoiceNumber: "4531", senderName: "Gabriela Soto", senderPhone: "8567-9012", receiverName: "Luis Mora", originFranchiseId: 1, destinationFranchiseId: 3, currentLocationId: 3, status: "RECIBIDO_EN_DESTINO", notes: "", createdBy: 1, createdAt: twoDaysAgo, updatedAt: yesterday, items: [{ id: 14, description: "Medias deportivas", quantity: 12, details: "Pack variado" }], tracking: [{ id: 29, status: "CREADO", notes: "Envio creado", createdAt: twoDaysAgo, actorName: "Usuario Los Chiles" }, { id: 30, status: "ENVIADO_A_BODEGA", notes: "Enviado a bodega", createdAt: twoDaysAgo, actorName: "Usuario Los Chiles" }, { id: 31, status: "RECIBIDO_EN_BODEGA", notes: "Recibido en bodega", createdAt: yesterday, actorName: "Administrador Bodega" }, { id: 32, status: "ENVIADO_A_DESTINO", notes: "Enviado a Santa Rosa", createdAt: yesterday, actorName: "Administrador Bodega" }, { id: 33, status: "RECIBIDO_EN_DESTINO", notes: "Recibido por Luis Mora", createdAt: now, actorName: "Usuario Santa Rosa" }] },
  ];

  return { shipments, nextId: 100 };
}

export function loadData(): DemoData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  const data = getInitialData();
  saveData(data);
  return data;
}

export function saveData(data: DemoData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getAuth() {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return null;
}

export function setAuth(user: any) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export function getShipments(): DemoShipment[] {
  return loadData().shipments;
}

export function getShipmentById(id: number): DemoShipment | undefined {
  return loadData().shipments.find((s) => s.id === id);
}

export function getShipmentByTracking(trackingNumber: string): DemoShipment | undefined {
  return loadData().shipments.find((s) => s.trackingNumber.toUpperCase() === trackingNumber.toUpperCase());
}

export function addShipment(shipment: Omit<DemoShipment, "id">): DemoShipment {
  const data = loadData();
  const newShipment = { ...shipment, id: data.nextId++ };
  data.shipments.unshift(newShipment);
  saveData(data);
  return newShipment;
}

export function updateShipmentStatus(
  id: number,
  status: string,
  notes: string | null,
  actorName: string
): DemoShipment | undefined {
  const data = loadData();
  const idx = data.shipments.findIndex((s) => s.id === id);
  if (idx === -1) return undefined;

  const s = data.shipments[idx];
  s.status = status;
  s.updatedAt = new Date().toISOString();

  // Update current location based on status
  if (status === "RECIBIDO_EN_BODEGA" || status === "ENVIADO_A_DESTINO") {
    s.currentLocationId = 8; // bodega
  } else if (status === "RECIBIDO_EN_DESTINO") {
    s.currentLocationId = s.destinationFranchiseId;
  } else if (status === "ENVIADO_A_BODEGA") {
    s.currentLocationId = s.originFranchiseId;
  }

  // Add tracking entry
  const nextTrackId = Math.max(...data.shipments.flatMap((sh) => sh.tracking.map((t) => t.id)), 0) + 1;
  s.tracking.unshift({
    id: nextTrackId,
    status,
    notes,
    createdAt: new Date().toISOString(),
    actorName,
  });

  saveData(data);
  return s;
}

export function cancelShipment(id: number, reason: string, actorName: string): DemoShipment | undefined {
  return updateShipmentStatus(id, "CANCELADO", reason, actorName);
}

export function generateTrackingNumber(): string {
  const data = loadData();
  const nums = data.shipments
    .map((s) => {
      const m = s.trackingNumber.match(/^AO-(\d+)-/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  const seq = String(max + 1).padStart(4, "0");
  const suffix = randomSuffix(2);
  return `AO-${seq}-${suffix}`;
}

function randomSuffix(length: number): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getFranchiseName(id: number): string {
  return FRANCHISES.find((f) => f.id === id)?.displayName || "Desconocido";
}

export function getUserForFranchise(franchiseId: number) {
  return FRANCHISE_USERS.find((u) => u.franchiseId === franchiseId);
}

export function loginFranchise(username: string, password: string) {
  if (password !== DEFAULT_PASSWORD) return null;
  const user = FRANCHISE_USERS.find((u) => u.username === username);
  if (!user) return null;
  const franchise = FRANCHISES.find((f) => f.id === user.franchiseId);
  const authData = { ...user, franchise };
  setAuth(authData);
  return authData;
}
