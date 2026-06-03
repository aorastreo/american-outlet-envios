// v5-force-rebuild
import { Routes, Route } from "react-router";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import CreateShipment from "./pages/CreateShipment";
import Shipments from "./pages/Shipments";
import ShipmentDetail from "./pages/ShipmentDetail";
import Track from "./pages/Track";
import Boleta from "./pages/Boleta";
import Bitacora from "./pages/Bitacora";
import Rutas from "./pages/Rutas";
import RutaDetail from "./pages/RutaDetail";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/enviar" element={<CreateShipment />} />
      <Route path="/envios" element={<Shipments />} />
      <Route path="/envios/:id" element={<ShipmentDetail />} />
      <Route path="/rastrear" element={<Track />} />
      <Route path="/boleta/:id" element={<Boleta />} />
      <Route path="/bitacora" element={<Bitacora />} />
      <Route path="/rutas" element={<Rutas />} />
      <Route path="/rutas/:id" element={<RutaDetail />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
