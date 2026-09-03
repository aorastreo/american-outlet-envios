import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type WarehouseLocation = "Bodega Pavón" | "Bodega Cedi" | "Todas";

interface WarehouseContextType {
  selectedWarehouse: WarehouseLocation;
  setSelectedWarehouse: (loc: WarehouseLocation) => void;
}

const WarehouseContext = createContext<WarehouseContextType | null>(null);

const STORAGE_KEY = "warehouse_location_v1";

export function WarehouseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedWarehouse, setSelectedWarehouseState] = useState<WarehouseLocation>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "Bodega Pavón" || saved === "Bodega Cedi" || saved === "Todas") {
        return saved;
      }
    } catch {
      // localStorage not available
    }
    return "Bodega Pavón";
  });

  const setSelectedWarehouse = useCallback((loc: WarehouseLocation) => {
    setSelectedWarehouseState(loc);
    try {
      localStorage.setItem(STORAGE_KEY, loc);
    } catch {
      // localStorage not available
    }
  }, []);

  return (
    <WarehouseContext.Provider value={{ selectedWarehouse, setSelectedWarehouse }}>
      {children}
    </WarehouseContext.Provider>
  );
}

export function useWarehouse() {
  const ctx = useContext(WarehouseContext);
  if (!ctx) {
    throw new Error("useWarehouse must be used within WarehouseProvider");
  }
  return ctx;
}
