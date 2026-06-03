import {
  shipments,
  shipmentItems,
  shipmentTracking,
  franchises,
  franchiseUsers,

const statusEnum = z.enum([
  "CREADO",
  "ENVIADO_A_BODEGA",
  "RECIBIDO_EN_BODEGA",
  "ENVIADO_A_DESTINO",
  "RECIBIDO_EN_DESTINO",
  "EN_RUTA",
  "EN_PARADA",
  "CANCELADO",
]);

// ─── TRACKING NUMBER GENERATION ──────────────────────────────────
function randomDigit(): string {
  return String(Math.floor(Math.random() * 10));


function randomLetter(): string {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ"; // excluye I, L, O para evitar confusiones
  return letters.charAt(Math.floor(Math.random() * letters.length));

async function generateTrackingNumber(): Promise<string> {
  const db = getDb();

  // Generar numeros de guia impredecibles: AO + 8 digitos aleatorios + 1 letra
  // Ejemplo: AO84729153X, AO10293847K
  // Sin guiones, sin secuencia predecible
  for (let attempt = 0; attempt < 10; attempt++) {
    let numberPart = "";
    for (let i = 0; i < 8; i++) {
      numberPart += randomDigit();
    const letter = randomLetter();

    // Verificar que no exista ya en la base de datos
    const existing = await db
      .from(shipments)
      .where(eq(shipments.trackingNumber, trackingNumber))
      .limit(1);

    if (existing.length === 0) {
      return trackingNumber; // Unico, lo retornamos
    // Si existe, intentamos otra vez con otros numeros

  // En el caso extremo de 10 colisiones, agregar timestamp para garantizar unicidad
  return fallbackNumber;

export const shipmentRouter = createRouter({
  // ─── Create Shipment ───────────────────────────────────────────
  create: franchiseAuthedQuery
    .input(
      z.object({
        invoiceNumber: z.string().max(50).optional(),
        senderName: z.string().min(1).max(255),
        senderPhone: z.string().min(1).max(50),
        destinationFranchiseId: z.number().min(1),
        notes: z.string().optional(),
        items: z.array(
          z.object({
            description: z.string().min(1).max(255),
            quantity: z.number().min(1).default(1),
            details: z.string().max(500).optional(),
        ).min(1),
    )
      const db = getDb();
      const originId = ctx.franchiseUser!.franchiseId;

      if (originId === input.destinationFranchiseId) {

      const bodegaResult = await db.select().from(franchises).where(eq(franchises.isWarehouse, 1)).limit(1);
      const bodegaId = bodegaResult[0]?.id;

      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, originId)).limit(1);
      const originIsWarehouse = userFranchise[0]?.isWarehouse === 1;

      if (originIsWarehouse && input.destinationFranchiseId === bodegaId) {

      if (input.invoiceNumber?.trim()) {
        const existingInvoice = await db.select().from(shipments).where(eq(shipments.invoiceNumber, input.invoiceNumber.trim())).limit(1);
        if (existingInvoice.length > 0) {


      const trackingNumber = await generateTrackingNumber();

      const shipmentResult = await db.insert(shipments).values({
        trackingNumber,
        invoiceNumber: input.invoiceNumber?.trim() || null,
        senderName: input.senderName.trim(),
        senderPhone: input.senderPhone.trim(),
        originFranchiseId: originId,
        destinationFranchiseId: input.destinationFranchiseId,
        currentLocationId: originId,
        status: "CREADO",
        notes: input.notes?.trim() || null,
        createdBy: ctx.franchiseUser!.id,

      const shipmentId = Number(shipmentResult[0].insertId);
      for (const item of input.items) {


  // ─── List Shipments (with pagination) ──────────────────────────
  list: franchiseAuthedQuery
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
    )
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;
      const page = input?.page || 1;
      const pageSize = input?.limit || 50;
      const offset = (page - 1) * pageSize;

      const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
      const isWarehouse = userFranchise[0]?.isWarehouse === 1;

      const conditions = [
        eq(shipments.originFranchiseId, franchiseId),
        eq(shipments.destinationFranchiseId, franchiseId),
        eq(shipments.currentLocationId, franchiseId),
      ];
      if (isWarehouse) conditions.push(eq(shipments.status, "ENVIADO_A_BODEGA"));

      const result = await db
        .select({
          id: shipments.id,
          trackingNumber: shipments.trackingNumber,
          invoiceNumber: shipments.invoiceNumber,
          senderName: shipments.senderName,
          senderPhone: shipments.senderPhone,
          status: shipments.status,
          notes: shipments.notes,
          createdAt: shipments.createdAt,
          updatedAt: shipments.updatedAt,
          originFranchiseId: shipments.originFranchiseId,
          destinationFranchiseId: shipments.destinationFranchiseId,
          currentLocationId: shipments.currentLocationId,
          createdBy: shipments.createdBy,
          originName: franchises.name,
        .from(shipments)
        .leftJoin(franchises, eq(franchises.id, shipments.originFranchiseId))
        .where(or(...conditions))
        .orderBy(desc(shipments.createdAt))
        .limit(pageSize)
        .offset(offset);

      return result;

  // ─── Get Shipment by ID (with actor names in tracking) ─────────
  getById: franchiseAuthedQuery
      const db = getDb();
      // franchiseId e isWarehouse removidos - todas las franquicias pueden ver cualquier envio

      const shipment = await db.select().from(shipments).where(eq(shipments.id, input.id)).limit(1);
      if (shipment.length === 0) return null;

      // Verify permission: user can only see shipments related to their franchise
      const s = shipment[0];
      // TODAS las franquicias pueden ver cualquier envio

      const items = await db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, input.id));

      const trackingHistory = await db
        .select()
        .from(shipmentTracking)
        .where(eq(shipmentTracking.shipmentId, input.id))
        .orderBy(shipmentTracking.createdAt);

      // Get franchise names
      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

      // Get all actor names (franchise users)
      const actorIds = [...new Set(trackingHistory.map(t => t.createdBy))].filter(Boolean);
      const actors = actorIds.length > 0
        ? await db.select().from(franchiseUsers).where(inArray(franchiseUsers.id, actorIds))
        : [];
      const actorMap = new Map(actors.map(a => [a.id, a.displayName]));

      const trackingWithActors = trackingHistory.map(t => ({
        ...t,
        actorName: actorMap.get(t.createdBy) || "Sistema",

      const destFranchise = franchiseMap.get(shipment[0].destinationFranchiseId);
      const pickupCodes = ["grecia", "san_ramon", "palmares"];
      const isPickupRoute = pickupCodes.includes(destFranchise?.code?.toLowerCase() || "") ||
                            (destFranchise?.displayName?.toLowerCase() || "").includes("recogida");

      return {
        ...shipment[0],
        items,
        tracking: trackingWithActors,
        originFranchise: franchiseMap.get(shipment[0].originFranchiseId),
        destinationFranchise: destFranchise,
        destinationFranchiseId: shipment[0].destinationFranchiseId,
        currentLocation: franchiseMap.get(shipment[0].currentLocationId),
        isPickupRoute,

  // ─── Update Status (with receiverName support) ─────────────────
  updateStatus: franchiseAuthedQuery
    .input(
      z.object({
        id: z.number(),
        newStatus: statusEnum,
        notes: z.string().optional(),
        receiverName: z.string().optional(),
    )
      const db = getDb();
      // franchiseId e isWarehouse removidos - todas las franquicias pueden ver cualquier envio

      const current = await db.select().from(shipments).where(eq(shipments.id, input.id)).limit(1);

      const shipment = current[0];
      const bodegaResult = await db.select().from(franchises).where(eq(franchises.isWarehouse, 1)).limit(1);
      const bodegaId = bodegaResult[0]?.id;
      const originIsWarehouse = shipment.originFranchiseId === bodegaId;

      // Validate transitions
      const validTransitions: Record<string, string[]> = originIsWarehouse

      const allowed = validTransitions[shipment.status] || [];
      if (!allowed.includes(input.newStatus)) {

      // Validate permissions
      if (input.newStatus === "ENVIADO_A_BODEGA" && shipment.originFranchiseId !== franchiseId) {
        const canConfirm = originIsWarehouse ? (shipment.originFranchiseId === franchiseId) : isWarehouse;

      let newLocationId = shipment.currentLocationId;
      if (input.newStatus === "ENVIADO_A_BODEGA") newLocationId = bodegaId || shipment.currentLocationId;
      else if (input.newStatus === "RECIBIDO_EN_BODEGA") newLocationId = bodegaId || shipment.currentLocationId;
      else if (input.newStatus === "ENVIADO_A_DESTINO") newLocationId = shipment.destinationFranchiseId;
      else if (input.newStatus === "RECIBIDO_EN_DESTINO") newLocationId = shipment.destinationFranchiseId;

      // Build update data
      const updateData: Record<string, any> = {
        status: input.newStatus,
        currentLocationId: newLocationId,
      if (input.newStatus === "RECIBIDO_EN_DESTINO" && input.receiverName?.trim()) {
        updateData.receiverName = input.receiverName.trim();

      await db.update(shipments).set(updateData).where(eq(shipments.id, input.id));

      const statusNotes: Record<string, string> = {
        ENVIADO_A_BODEGA: "Enviado a bodega por tienda de origen",
        RECIBIDO_EN_BODEGA: "Recibido en bodega",
        ENVIADO_A_DESTINO: originIsWarehouse ? "Enviado directamente desde bodega a tienda de destino" : "Enviado a tienda de destino desde bodega",
        RECIBIDO_EN_DESTINO: input.receiverName?.trim()
          : "Recibido en tienda de destino",

      await db.insert(shipmentTracking).values({
        shipmentId: input.id,
        status: input.newStatus,
        locationId: newLocationId,
        createdBy: ctx.franchiseUser!.id,


  // ─── Cancel Shipment ───────────────────────────────────────────
  cancel: franchiseAuthedQuery
      const db = getDb();
      const franchiseId = ctx.franchiseUser!.franchiseId;

      const current = await db.select().from(shipments).where(eq(shipments.id, input.id)).limit(1);

      const shipment = current[0];

      // Only origin or destination can cancel, and only if not already delivered or cancelled
      if (shipment.status === "RECIBIDO_EN_DESTINO" || shipment.status === "CANCELADO") {

      const isInvolved = shipment.originFranchiseId === franchiseId ||
                         shipment.destinationFranchiseId === franchiseId ||
                         shipment.currentLocationId === franchiseId;
      if (!isInvolved) {

      await db.update(shipments)
        .where(eq(shipments.id, input.id));

      await db.insert(shipmentTracking).values({
        shipmentId: input.id,
        status: "CANCELADO",
        locationId: shipment.originFranchiseId,
        createdBy: ctx.franchiseUser!.id,


  // ─── Public Track ──────────────────────────────────────────────
  track: publicQuery
      const db = getDb();
      const shipment = await db.select().from(shipments).where(eq(shipments.trackingNumber, input.trackingNumber)).limit(1);

      const items = await db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, shipment[0].id));
      const trackingHistory = await db.select().from(shipmentTracking).where(eq(shipmentTracking.shipmentId, shipment[0].id)).orderBy(shipmentTracking.createdAt);

      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

      const destFranchise = franchiseMap.get(shipment[0].destinationFranchiseId);
      const pickupCodes = ["grecia", "san_ramon", "palmares"];
      const isPickupRoute = pickupCodes.includes(destFranchise?.code?.toLowerCase() || "") ||
                            (destFranchise?.displayName?.toLowerCase() || "").includes("recogida");

      return {
        ...shipment[0],
        items,
        tracking: trackingHistory,
        originFranchise: franchiseMap.get(shipment[0].originFranchiseId),
        destinationFranchise: franchiseMap.get(shipment[0].destinationFranchiseId),
        destinationFranchiseId: shipment[0].destinationFranchiseId,
        currentLocation: franchiseMap.get(shipment[0].currentLocationId),
        isPickupRoute,

  // ─── Stats ─────────────────────────────────────────────────────
    const db = getDb();
    const franchiseId = ctx.franchiseUser!.franchiseId;
    const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
    const isWarehouse = userFranchise[0]?.isWarehouse === 1;

    const conditions = [
      eq(shipments.originFranchiseId, franchiseId),
      eq(shipments.destinationFranchiseId, franchiseId),
      eq(shipments.currentLocationId, franchiseId),
    ];
    if (isWarehouse) conditions.push(eq(shipments.status, "ENVIADO_A_BODEGA"));

    const allShipments = await db.select().from(shipments).where(or(...conditions));
    const pending = allShipments.filter((s) => s.status !== "RECIBIDO_EN_DESTINO" && s.status !== "CANCELADO");

    return {
      total: allShipments.length,
      pending: pending.length,
      delivered: allShipments.filter((s) => s.status === "RECIBIDO_EN_DESTINO").length,
      inTransit: allShipments.filter((s) => s.status === "ENVIADO_A_BODEGA" || s.status === "ENVIADO_A_DESTINO").length,
      inWarehouse: allShipments.filter((s) => s.status === "RECIBIDO_EN_BODEGA").length,
      cancelled: allShipments.filter((s) => s.status === "CANCELADO").length,

  // ─── Pending count (for sidebar badge) ─────────────────────────
    const db = getDb();
    const franchiseId = ctx.franchiseUser!.franchiseId;
    const userFranchise = await db.select().from(franchises).where(eq(franchises.id, franchiseId)).limit(1);
    const isWarehouse = userFranchise[0]?.isWarehouse === 1;

    const conditions: any[] = [
    ];

    if (isWarehouse) {
      conditions.push(eq(shipments.status, "ENVIADO_A_BODEGA"));

    const countResult = await db
      .from(shipments)
      .where(or(...conditions));

    return countResult[0]?.count || 0;

  // ─── Get Boleta (printable receipt for package) ────────────────
  getBoleta: publicQuery
      const db = getDb();

      const shipment = await db
        .select()
        .from(shipments)
        .where(eq(shipments.id, input.id))
        .limit(1);

      const items = await db
        .select()
        .from(shipmentItems)
        .where(eq(shipmentItems.shipmentId, input.id));

      const trackingHistory = await db
        .select()
        .from(shipmentTracking)
        .where(eq(shipmentTracking.shipmentId, input.id))
        .orderBy(shipmentTracking.createdAt);

      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

      return {
        ...shipment[0],
        items,
        tracking: trackingHistory,
        originFranchise: franchiseMap.get(shipment[0].originFranchiseId),
        destinationFranchise: franchiseMap.get(shipment[0].destinationFranchiseId),
        currentLocation: franchiseMap.get(shipment[0].currentLocationId),

  // ─── Get Bitácora (multiple shipments for delivery manifest) ───
  getBitacora: franchiseAuthedQuery
      const db = getDb();
      // franchiseId e isWarehouse removidos - todas las franquicias pueden ver cualquier envio

      const result = await db
        .select({
          id: shipments.id,
          trackingNumber: shipments.trackingNumber,
          invoiceNumber: shipments.invoiceNumber,
          senderName: shipments.senderName,
          senderPhone: shipments.senderPhone,
          receiverName: shipments.receiverName,
          originFranchiseId: shipments.originFranchiseId,
          destinationFranchiseId: shipments.destinationFranchiseId,
          currentLocationId: shipments.currentLocationId,
          status: shipments.status,
          notes: shipments.notes,
          createdAt: shipments.createdAt,
          originName: franchises.name,
          originDisplayName: franchises.displayName,
        .from(shipments)
        .leftJoin(franchises, eq(franchises.id, shipments.originFranchiseId))
        .where(inArray(shipments.id, input.ids))
        .orderBy(desc(shipments.createdAt));

      // Filter: user can only see shipments related to their franchise
      const filtered = result.filter(s =>
        s.originFranchiseId === franchiseId ||
      );

      if (filtered.length === 0) {

      // Get items for allowed shipments only
      const allowedIds = filtered.map(s => s.id);
      const items = await db
        .select()
        .from(shipmentItems)
        .where(inArray(shipmentItems.shipmentId, allowedIds));

      const itemsByShipment = new Map<number, typeof items>();
      for (const item of items) {
        if (!itemsByShipment.has(item.shipmentId)) itemsByShipment.set(item.shipmentId, []);
        itemsByShipment.get(item.shipmentId)!.push(item);

      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

      return {
        shipments: filtered.map(s => ({
          ...s,
          items: itemsByShipment.get(s.id) || [],
          destinationFranchise: franchiseMap.get(s.destinationFranchiseId),
        totalPackages: filtered.length,
        generatedAt: new Date(),

  // ─── MONTHLY REPORT BY FRANCHISE ──────────────────────────────
  monthlyReport: publicQuery
    .input(z.object({
      year: z.number().optional(),
      month: z.number().min(1).max(12).optional(),
      const db = getDb();
      const now = new Date();
      const year = input?.year ?? now.getFullYear();
      const month = input?.month ?? now.getMonth() + 1;

      const allFranchises = await db.select().from(franchises);
      const franchiseMap = new Map(allFranchises.map(f => [f.id, f]));

      const allShipments = await db.select().from(shipments);

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);

      const monthlyShipments = allShipments.filter(s => {
        const created = new Date(s.createdAt);
        return created >= startDate && created < endDate;

      const statsByFranchise = new Map<number, {
        franchise: typeof allFranchises[0];
        created: number;
        sentToWarehouse: number;
        receivedInWarehouse: number;
        sentToDestination: number;
        receivedAtDestination: number;

      for (const f of allFranchises) {
        statsByFranchise.set(f.id, {
          franchise: f,
          created: 0,
          sentToWarehouse: 0,
          receivedInWarehouse: 0,
          sentToDestination: 0,
          receivedAtDestination: 0,

      for (const s of monthlyShipments) {
        const origin = statsByFranchise.get(s.originFranchiseId);
        if (origin) origin.created++;

        if (s.status === "ENVIADO_A_BODEGA" || s.status === "RECIBIDO_EN_BODEGA" || s.status === "ENVIADO_A_DESTINO" || s.status === "RECIBIDO_EN_DESTINO") {
          const origin2 = statsByFranchise.get(s.originFranchiseId);
          if (origin2) origin2.sentToWarehouse++;
        if (s.status === "RECIBIDO_EN_BODEGA" || s.status === "ENVIADO_A_DESTINO" || s.status === "RECIBIDO_EN_DESTINO") {
          const warehouse = statsByFranchise.get(s.currentLocationId);
          if (warehouse) warehouse.receivedInWarehouse++;
        if (s.status === "ENVIADO_A_DESTINO" || s.status === "RECIBIDO_EN_DESTINO") {
          const dest = statsByFranchise.get(s.currentLocationId);
          if (dest) dest.sentToDestination++;
        if (s.status === "RECIBIDO_EN_DESTINO") {
          const dest = statsByFranchise.get(s.destinationFranchiseId);
          if (dest) dest.receivedAtDestination++;

      const total = monthlyShipments.length;

      return {
        year,
        month,
        totalShipments: total,
        byFranchise: Array.from(statsByFranchise.values()).filter(s => s.created > 0 || s.receivedAtDestination > 0),
