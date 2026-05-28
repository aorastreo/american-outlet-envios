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
} from "lucide-react";
import { trpc } from "@/providers/trpc";

const logoUrl = "/logo.jpg";

export default function Login() {
  const navigate = useNavigate();
  const loginMutation = trpc.franchiseAuth.login.useMutation();
  const [franchiseName, setFranchiseName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const franchises = [
    { value: "los_chiles", label: "Los Chiles" },
    { value: "pavon", label: "Pavon" },
    { value: "santa_rosa", label: "Santa Rosa" },
    { value: "boca_arenal", label: "Boca Arenal" },
    { value: "florencia", label: "Florencia" },
    { value: "fortuna", label: "Fortuna" },
    { value: "ciudad_quesada", label: "Ciudad Quesada" },
    { value: "bodega", label: "Bodega" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!franchiseName || !password) {
      setError("Seleccione su franquicia e ingrese la contraseña");
      return;
    }

    try {
      await loginMutation.mutateAsync({ username: franchiseName, password });
      navigate("/dashboard");
    } catch (err: any) {
      setError(
        err.message || "Error al iniciar sesion. Verifique sus credenciales."
      );
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
            alt="American Outlet"
            className="w-16 h-16 rounded-2xl object-contain bg-white mb-4 shadow-lg"
          />
          <h1 className="text-2xl font-bold text-[#1A1A1A]">
            American Outlet
          </h1>
          <p className="text-sm text-[#8A8A8A] mt-1">
            Acceso para Franquicias
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
                <Input
                  id="password"
                  type="password"
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 border-[#D4D4D4] focus:ring-[#C8102E] focus:border-[#C8102E]"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[#C8102E] hover:bg-[#9B0B22] text-white font-medium"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
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
              Sistema exclusivo para franquicias American Outlet
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
