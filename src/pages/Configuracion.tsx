import { useState } from "react";
import { toast } from "react-hot-toast";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";

export default function Configuracion() {
  const franchises = trpc.franchiseAuth.passwordFranchises.useQuery();
  const [franchiseId, setFranchiseId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const selected = (franchises.data || []).find((franchise) => String(franchise.id) === franchiseId);

  const save = trpc.franchiseAuth.setFranchisePassword.useMutation({
    onSuccess: (data) => {
      toast.success(`Clave guardada. ${data.username} entra con la clave nueva.`);
      setPassword("");
      setConfirm("");
    },
    onError: (error) => toast.error(error.message || "No se pudo guardar la clave"),
  });

  return (
    <FranchiseLayout>
      <div className="max-w-xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A1A]">Configuraciones</h1>
          <p className="text-sm text-[#8A8A8A] mt-1">Ajustes de Bodega Pavon y Bodega Cedi.</p>
        </div>

        <form
          className="bg-white border border-[#E5E5E5] rounded-xl p-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selected) {
              toast.error("Seleccione la franquicia");
              return;
            }
            if (password.trim().length < 4) {
              toast.error("La clave necesita al menos 4 caracteres");
              return;
            }
            if (password !== confirm) {
              toast.error("Las dos claves no coinciden");
              return;
            }
            save.mutate({ franchiseId: selected.id, password });
          }}
        >
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A]">Claves</h2>
            <p className="text-sm text-[#8A8A8A] mt-1">
              La clave anterior deja de servir. La tienda entra con su usuario de siempre y la clave nueva.
            </p>
          </div>

          <select
            value={franchiseId}
            onChange={(event) => setFranchiseId(event.target.value)}
            className="h-11 w-full px-3 text-sm border border-[#D4D4D4] rounded-lg bg-white"
          >
            <option value="">Seleccione la franquicia</option>
            {(franchises.data || []).map((franchise) => (
              <option key={franchise.id} value={franchise.id}>
                {franchise.name}
              </option>
            ))}
          </select>

          {selected && (
            <p className="text-sm text-[#525252]">
              Usuario: <span className="font-mono font-medium text-[#1A1A1A]">{selected.username}</span>
            </p>
          )}

          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Clave nueva"
            type="password"
            autoComplete="new-password"
            className="h-11 w-full px-3 text-sm border border-[#D4D4D4] rounded-lg"
          />
          <input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Repita la clave"
            type="password"
            autoComplete="new-password"
            className="h-11 w-full px-3 text-sm border border-[#D4D4D4] rounded-lg"
          />
          <p className="text-xs text-[#8A8A8A]">
            Si esa franquicia tenia otras personas, esas dejan de entrar.
          </p>
          <button
            type="submit"
            disabled={save.isPending}
            className="h-11 px-4 rounded-lg bg-[#1A1A1A] text-white text-sm font-medium disabled:opacity-60"
          >
            {save.isPending ? "Guardando..." : "Guardar clave"}
          </button>
        </form>
      </div>
    </FranchiseLayout>
  );
}
