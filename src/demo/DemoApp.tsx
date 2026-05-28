import { Routes, Route, Navigate } from "react-router";
import { useDemoAuth } from "./useDemoAuth";
import DemoLayout from "./DemoLayout";
import DemoLogin from "./DemoLogin";
import DemoHome from "./DemoHome";
import DemoDashboard from "./DemoDashboard";
import DemoShipments from "./DemoShipments";
import DemoCreateShipment from "./DemoCreateShipment";
import DemoShipmentDetail from "./DemoShipmentDetail";
import { DemoBoleta } from "./DemoBoleta";
import { DemoBitacora } from "./DemoBitacora";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useDemoAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <DemoLayout>{children}</DemoLayout>;
}

export default function DemoApp() {
  return (
    <Routes>
      <Route path="/" element={<DemoHome />} />
      <Route path="/login" element={<DemoLogin />} />
      <Route path="/rastrear" element={<DemoHome />} />
      <Route path="/dashboard" element={<ProtectedRoute><DemoDashboard /></ProtectedRoute>} />
      <Route path="/envios" element={<ProtectedRoute><DemoShipments /></ProtectedRoute>} />
      <Route path="/enviar" element={<ProtectedRoute><DemoCreateShipment /></ProtectedRoute>} />
      <Route path="/envios/:id" element={<ProtectedRoute><DemoShipmentDetail /></ProtectedRoute>} />
      <Route path="/boleta/:id" element={<DemoBoleta />} />
      <Route path="/bitacora" element={<DemoBitacora />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
