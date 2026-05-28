import { trpc } from "@/providers/trpc";
import { useCallback, useMemo } from "react";

export function useFranchiseAuth() {
  const utils = trpc.useUtils();

  const {
    data: user,
    isLoading,
    error,
  } = trpc.franchiseAuth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const logoutMutation = trpc.franchiseAuth.logout.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      window.location.href = "/login";
    },
  });

  const logout = useCallback(() => logoutMutation.mutate(), [logoutMutation]);

  return useMemo(
    () => ({
      user: user ?? null,
      isAuthenticated: !!user,
      isLoading: isLoading || logoutMutation.isPending,
      error,
      logout,
      isAdmin: user?.role === "admin",
    }),
    [user, isLoading, logoutMutation.isPending, error, logout]
  );
}
