import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { matchShipmentCode, type CheckableShipment } from "@/lib/shipment-check";

export type ReviewGroup = {
  key: string;
  label: string;
  count: number;
};

type Props = {
  mode: "salida" | "recepcion" | "entrega";
  groups: ReviewGroup[];
  activeGroup: string | null;
  onGroup: (key: string | null) => void;
  shipments: CheckableShipment[];
  waitingShipments?: CheckableShipment[];
  selectedIds: number[];
  onMark: (id: number) => void;
  onPrint: () => void;
};

export default function ShipmentCheckBar({
  mode,
  groups,
  activeGroup,
  onGroup,
  shipments,
  waitingShipments = [],
  selectedIds,
  onMark,
  onPrint,
}: Props) {
  const [code, setCode] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [choices, setChoices] = useState<{ label: string; sameInvoice: boolean; shipments: CheckableShipment[] } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onCodeRef = useRef<(value: string) => void>(() => {});
  const lastScanRef = useRef({ value: "", at: 0 });

  const readCount = shipments.filter((shipment) => selectedIds.includes(shipment.id)).length;
  const place = mode === "recepcion" ? "Viene de" : mode === "entrega" ? "Cliente" : "Para";

  const markShipment = (shipment: CheckableShipment) => {
    if (selectedIds.includes(shipment.id)) {
      toast(`${shipment.trackingNumber} ya estaba leido`);
      return;
    }
    onMark(shipment.id);
    toast.success(`${shipment.trackingNumber} leido`);
  };

  const applyCode = (raw: string) => {
    const match = matchShipmentCode(raw, shipments);
    if (match.status === "empty") return;
    if (match.status === "none") {
      setChoices(null);
      if (mode === "entrega") {
        toast.error("Ese paquete no esta esperando al cliente en esta tienda");
        return;
      }
      const waiting = matchShipmentCode(raw, waitingShipments);
      toast.error(
        waiting.status === "one"
          ? "Ese paquete sigue en bodega. Se recibe cuando ya va hacia la tienda."
          : "Ese numero no esta en esta lista",
      );
      return;
    }
    if (match.status === "many") {
      const invoices = [...new Set(match.shipments.map((shipment) => (shipment.invoiceNumber || "").trim()).filter(Boolean))];
      const sameInvoice = invoices.length === 1;
      setChoices({
        label: sameInvoice ? invoices[0] : raw.trim(),
        sameInvoice,
        shipments: match.shipments,
      });
      return;
    }
    setChoices(null);
    markShipment(match.shipment);
  };

  onCodeRef.current = (value: string) => {
    const key = value.trim().toUpperCase();
    const now = Date.now();
    if (lastScanRef.current.value === key && now - lastScanRef.current.at < 2000) return;
    lastScanRef.current = { value: key, at: now };
    applyCode(key);
  };

  const stopCamera = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch {
      // The camera is already closed.
    }
  };

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, []);

  const toggleCamera = async () => {
    setCameraError("");
    if (cameraOn) {
      await stopCamera();
      setCameraOn(false);
      return;
    }
    flushSync(() => setCameraOn(true));
    const scanner = new Html5Qrcode("shipment-qr-reader");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 8,
          qrbox: (width, height) => {
            const size = Math.max(50, Math.floor(Math.min(width, height) * 0.7));
            return { width: size, height: size };
          },
        },
        (text) => onCodeRef.current(text),
        () => {},
      );
    } catch {
      await stopCamera();
      setCameraOn(false);
      setCameraError("El celular no dejo usar la camara. Escribe el numero o toca la fila.");
    }
  };

  const ready = shipments.length > 0;

  return (
    <div className="rounded-xl border border-[#D4D4D4] bg-white p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#1A1A1A]">
            {ready
              ? `${readCount} de ${shipments.length} leido${shipments.length !== 1 ? "s" : ""}`
              : "Todavia no se pueden marcar"}
          </p>
          <p className="text-xs text-[#8A8A8A] mt-0.5">
            {mode === "entrega"
              ? "Escanea el paquete que retira el cliente. La computadora de la tienda ve la misma marca. Luego confirma y escribe el nombre de quien lo recibe."
              : ready
                ? "Escanea, escribe el numero o toca la fila. La computadora de la tienda ve estas mismas marcas."
                : "Se marcan cuando el paquete ya va hacia la tienda. Si lo escaneas antes, te avisa."}
          </p>
        </div>
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center justify-center gap-2 h-10 px-3 rounded-lg border border-[#D4D4D4] text-sm font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]"
        >
          <Printer className="w-4 h-4" />
          Imprimir bitacora
        </button>
      </div>

      {groups.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onGroup(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
              activeGroup === null
                ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                : "bg-white text-[#525252] border-[#D4D4D4]"
            }`}
          >
            Todos
          </button>
          {groups.map((group) => (
            <button
              key={group.key}
              type="button"
              onClick={() => onGroup(activeGroup === group.key ? null : group.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
                activeGroup === group.key
                  ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                  : "bg-white text-[#525252] border-[#D4D4D4]"
              }`}
            >
              {place} {group.label} · {group.count}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          applyCode(code);
          setCode("");
        }}
      >
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Rastreo o factura"
          autoComplete="off"
          className="min-w-[12rem] flex-1 h-11 px-3 text-sm border border-[#D4D4D4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E]"
        />
        <button
          type="submit"
          className="h-11 px-4 rounded-lg bg-[#1A1A1A] text-white text-sm font-medium"
        >
          Marcar
        </button>
        <button
          type="button"
          onClick={() => {
            void toggleCamera();
          }}
          className="h-11 px-3 w-full sm:w-auto rounded-lg border border-[#C8102E] text-[#C8102E] text-sm font-medium inline-flex items-center justify-center gap-2"
        >
          <Camera className="w-4 h-4" />
          {cameraOn ? "Cerrar camara" : "Escanear con el celular"}
        </button>
      </form>

      {choices && (
        <div className="rounded-lg border border-[#C8102E]/30 bg-[#FFF5F5] p-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-[#1A1A1A]">
              {choices.sameInvoice
                ? `La factura ${choices.label} tiene ${choices.shipments.length} paquetes. Toca el que tiene los articulos de la caja.`
                : `Hay ${choices.shipments.length} paquetes con esos digitos. Toca el que tiene los articulos de la caja.`}
            </p>
            <button
              type="button"
              onClick={() => setChoices(null)}
              className="shrink-0 text-xs font-medium text-[#525252]"
            >
              Cerrar
            </button>
          </div>
          <div className="space-y-2">
            {choices.shipments.map((shipment) => {
              const read = selectedIds.includes(shipment.id);
              const route = [shipment.originName, shipment.destinationName].filter(Boolean).join(" → ");
              const articles = (shipment.items || [])
                .map((item) => {
                  const line = `${item.description} x${item.quantity}`;
                  return item.details ? `${line} (${item.details})` : line;
                })
                .join(", ");
              return (
                <button
                  key={shipment.id}
                  type="button"
                  disabled={read}
                  onClick={() => markShipment(shipment)}
                  className={`w-full text-left rounded-lg border px-3 py-3 ${
                    read
                      ? "border-[#E5E5E5] bg-[#F7F7F7] text-[#8A8A8A]"
                      : "border-[#D4D4D4] bg-white hover:border-[#C8102E]"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`font-mono font-semibold ${read ? "text-[#8A8A8A]" : "text-[#C8102E]"}`}>
                      {shipment.trackingNumber}
                    </span>
                    <span className={`text-xs font-medium ${read ? "text-[#8A8A8A]" : "text-[#C8102E]"}`}>
                      {read ? "Ya leido" : "Marcar este"}
                    </span>
                  </span>
                  <span className={`block mt-1 text-sm font-medium ${read ? "text-[#8A8A8A]" : "text-[#1A1A1A]"}`}>
                    {articles || "Sin articulos anotados"}
                  </span>
                  {(shipment.senderName || route) && (
                    <span className="block mt-0.5 text-xs text-[#525252]">
                      {shipment.senderName}
                      {shipment.senderName && route ? " · " : ""}
                      {route}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {cameraError && <p className="text-sm text-amber-700">{cameraError}</p>}

      {cameraOn && (
        <div className="overflow-hidden rounded-lg border border-[#D4D4D4] bg-black max-w-sm">
          <div id="shipment-qr-reader" className="w-full min-h-[260px]" />
        </div>
      )}
    </div>
  );
}
