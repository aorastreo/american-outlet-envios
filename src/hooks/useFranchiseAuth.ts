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
    onSuccess: () => {
      // Navigate immediately — no need to invalidate queries,
      // the page change will unmount everything anyway
      window.location.replace("/login");
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
