import { useState } from "react";
import { toast } from "react-hot-toast";
import FranchiseLayout from "@/components/FranchiseLayout";
import { trpc } from "@/providers/trpc";
import { useFranchiseAuth } from "@/hooks/useFranchiseAuth";

export default function Equipo() {
  const { user } = useFranchiseAuth();
  const utils = trpc.useUtils();
  const team = trpc.franchiseAuth.team.useQuery();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const addMember = trpc.franchiseAuth.addTeamMember.useMutation({
    onSuccess: () => {
      toast.success("Persona creada. Ya puede entrar con su usuario.");
      setDisplayName("");
      setUsername("");
      setPassword("");
      utils.franchiseAuth.team.invalidate();
    },
    onError: (error) => toast.error(error.message || "No se pudo crear la persona"),
  });

  const setActive = trpc.franchiseAuth.setTeamMemberActive.useMutation({
    onSuccess: () => utils.franchiseAuth.team.invalidate(),
    onError: (error) => toast.error(error.message || "No se pudo actualizar"),
  });

  return (
    <FranchiseLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Personas</h1>
          <p className="text-sm text-[#8A8A8A] mt-1">
            Cada persona entra con su propio usuario. Asi queda escrito quien escaneo, confirmo o cancelo. La clave de la tienda sigue funcionando.
          </p>
        </div>

        <form
          className="rounded-xl border border-[#D4D4D4] bg-white p-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            addMember.mutate({
              displayName: displayName.trim(),
              username: username.trim().toLowerCase(),
              password,
            });
          }}
        >
          <p className="text-sm font-semibold text-[#1A1A1A]">Nueva persona</p>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Nombre"
            className="h-11 w-full px-3 text-sm border border-[#D4D4D4] rounded-lg"
          />
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            placeholder="Usuario, por ejemplo maria_chiles"
            autoCapitalize="none"
            className="h-11 w-full px-3 text-sm border border-[#D4D4D4] rounded-lg"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Clave"
            type="password"
            className="h-11 w-full px-3 text-sm border border-[#D4D4D4] rounded-lg"
          />
          <button
            type="submit"
            disabled={addMember.isPending}
            className="h-11 px-4 rounded-lg bg-[#C8102E] text-white text-sm font-medium"
          >
            Crear persona
          </button>
        </form>

        <div className="space-y-2">
          {(team.data || []).map((person) => (
            <div key={person.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E5E5] bg-white px-3 py-3">
              <div>
                <p className="text-sm font-medium text-[#1A1A1A]">{person.displayName}</p>
                <p className="text-xs text-[#8A8A8A]">
                  {person.username}
                  {person.id === user?.id ? " · Tu usuario" : ""}
                  {person.isActive ? "" : " · Inactivo"}
                </p>
              </div>
              {person.id !== user?.id && (
                <button
                  type="button"
                  onClick={() => setActive.mutate({ id: person.id, active: !person.isActive })}
                  className="text-xs font-medium text-[#525252]"
                >
                  {person.isActive ? "Desactivar" : "Activar"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </FranchiseLayout>
  );
}
