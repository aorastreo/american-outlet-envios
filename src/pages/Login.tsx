import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  LogIn,
  Store,
  AlertCircle,
  ArrowLeft,
  Truck,
  Package,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [franchiseName, setFranchiseName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const logoUrl = franchiseName === "ganga_santa_rosa" ? "/logo-ganga.jpg" : "/logo.jpg";
  const [isLoading, setIsLoading] = useState(false);

  // Solo franquicias que tienen acceso al sistema (puntos de recogida NO tienen login)
  const franchises = [
    { value: "los_chiles", label: "Los Chiles" },
    { value: "pavon", label: "Pavon" },
    { value: "santa_rosa", label: "Santa Rosa" },
    { value: "boca_arenal", label: "Boca Arenal" },
    { value: "florencia", label: "Florencia" },
    { value: "fortuna", label: "Fortuna" },
    { value: "ciudad_quesada", label: "Ciudad Quesada" },
    { value: "puerto_viejo", label: "Puerto Viejo" },
    { value: "ganga_santa_rosa", label: "Ganga Santa Rosa" },
    { value: "bodega_sabana", label: "Bodega Sabana" },
    { value: "chofer", label: "Chofer - Rutas" },
    { value: "bodega", label: "Bodega" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!franchiseName || !password) {
      setError("Seleccione su franquicia e ingrese la contraseña");
      return;
    }

    setIsLoading(true);
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: franchiseName, password }),
        credentials: "include",
      });

      const data = await resp.json();

      if (!resp.ok || data.error) {
        setError(data.error || "Error al iniciar sesion");
        setIsLoading(false);
        return;
      }

      // Store user in localStorage for session
      localStorage.setItem("franchise_user", JSON.stringify(data.user));
      navigate("/dashboard");
    } catch (err: any) {
      setError("Error al conectar con el servidor");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center p-4">
      {/* Back to home */}
      <div className="fixed top-4 left-4 z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-[#8A8A8A] hover:text-[#C8102E] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src={logoUrl}
            alt={franchiseName === "ganga_santa_rosa" ? "Ganga Santa Rosa" : "American Outlet"}
            className="w-16 h-16 rounded-2xl object-contain bg-white mb-4 shadow-lg"
          />
          <h1 className="text-2xl font-bold text-[#1A1A1A]">
            {franchiseName === "ganga_santa_rosa" ? "Ganga Santa Rosa" : "American Outlet"}
          </h1>
          <p className="text-sm text-[#8A8A8A] mt-1">
            {franchiseName === "ganga_santa_rosa" ? "Acceso para Tienda" : "Acceso para Franquicias"}
          </p>
        </div>

        <Card className="border-[#D4D4D4] shadow-sm">
          <CardContent className="p-6 space-y-6">
            {/* Features */}
            <div className="grid grid-cols-3 gap-2 text-center mb-2">
              {[
                { icon: Package, label: "Gestion" },
                { icon: Truck, label: "Envios" },
                { icon: Shield, label: "Seguro" },
              ].map((f) => (
                <div
                  key={f.label}
                  className="p-2 rounded-lg bg-[#F7F7F7]"
                >
                  <f.icon className="w-4 h-4 text-[#C8102E] mx-auto mb-1" />
                  <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wider font-medium">
                    {f.label}
                  </p>
                </div>
              ))}
            </div>

            {error && (
              <Alert
                variant="destructive"
                className="bg-red-50 border-red-200"
              >
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="franchise"
                  className="text-[#1A1A1A] font-medium"
                >
                  Franquicia
                </Label>
                <Select
                  value={franchiseName}
                  onValueChange={setFranchiseName}
                >
                  <SelectTrigger className="h-11 border-[#D4D4D4] focus:ring-[#C8102E] focus:border-[#C8102E]">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-[#C8102E]" />
                      <SelectValue placeholder="Seleccione su tienda" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {franchises.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-[#1A1A1A] font-medium"
                >
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Ingrese su contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 border-[#D4D4D4] focus:ring-[#C8102E] focus:border-[#C8102E] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-[#525252] transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[#C8102E] hover:bg-[#9B0B22] text-white font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Iniciar Sesion
                  </>
                )}
              </Button>
            </form>

                       <p className="text-center text-xs text-[#A3A3A3]">
              Sistema exclusivo para franquicias {franchiseName === "ganga_santa_rosa" ? "Ganga Santa Rosa" : "American Outlet"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
