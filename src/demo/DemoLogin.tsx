import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { LogIn, Store, AlertCircle, ArrowLeft, Package, Truck, Shield } from "lucide-react";
import { FRANCHISES } from "./data";
import { useDemoAuth } from "./useDemoAuth";

const logoUrl = "/logo.jpg";

export default function DemoLogin() {
  const navigate = useNavigate();
  const { login } = useDemoAuth();
  const [franchiseName, setFranchiseName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const franchises = FRANCHISES.filter((f) => !f.isWarehouse).map((f) => ({ value: f.code, label: f.displayName }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!franchiseName || !password) { setError("Seleccione su franquicia e ingrese la contraseña"); return; }
    setIsPending(true);
    const ok = login(franchiseName, password);
    setIsPending(false);
    if (ok) navigate("/dashboard");
    else setError("Usuario o contrasena incorrectos");
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center p-4">
      <div className="fixed top-4 left-4 z-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[#8A8A8A] hover:text-[#C8102E] transition-colors">
          <ArrowLeft className="w-4 h-4" />Volver al inicio
        </Link>
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logoUrl} alt="American Outlet" className="w-16 h-16 rounded-2xl object-contain bg-white mb-4 shadow-lg mx-auto" />
          <h1 className="text-2xl font-bold text-[#1A1A1A]">American Outlet</h1>
          <p className="text-sm text-[#8A8A8A] mt-1">Acceso para Franquicias</p>
        </div>
        <div className="bg-white border border-[#D4D4D4] rounded-xl shadow-sm">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-3 gap-2 text-center mb-2">
              {[{ icon: Package, label: "Gestion" }, { icon: Truck, label: "Envios" }, { icon: Shield, label: "Seguro" }].map((f) => (
                <div key={f.label} className="p-2 rounded-lg bg-[#F7F7F7]">
                  <f.icon className="w-4 h-4 text-[#C8102E] mx-auto mb-1" />
                  <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wider font-medium">{f.label}</p>
                </div>
              ))}
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700"><AlertCircle className="w-4 h-4 text-red-600 shrink-0" />{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1A1A1A]">Franquicia</label>
                <select value={franchiseName} onChange={(e) => setFranchiseName(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-[#D4D4D4] bg-white text-sm focus:ring-[#C8102E] focus:border-[#C8102E] outline-none">
                  <option value="">Seleccione su tienda</option>
                  {franchises.map((f) => (<option key={f.value} value={f.value}>{f.label}</option>))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1A1A1A]">Contrasena</label>
                <input type="password" placeholder="Ingrese su contrasena" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-[#D4D4D4] text-sm focus:ring-[#C8102E] focus:border-[#C8102E] outline-none" />
                <p className="text-xs text-[#A3A3A3]">Contrasena por defecto: <code className="bg-[#F0F0F0] px-1.5 py-0.5 rounded">american2025</code></p>
              </div>
              <button type="submit" disabled={isPending} className="w-full h-11 bg-[#C8102E] hover:bg-[#9B0B22] text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
                {isPending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><LogIn className="w-4 h-4" />Iniciar Sesion</>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
