import { useState, useEffect, useCallback } from "react";
import { getAuth, setAuth, clearAuth, loginFranchise, FRANCHISES } from "./data";

export function useDemoAuth() {
  const [user, setUser] = useState<any>(getAuth());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    if (auth) setUser(auth);
  }, []);

  const login = useCallback(
    (username: string, password: string): boolean => {
      setIsLoading(true);
      const result = loginFranchise(username, password);
      setIsLoading(false);
      if (result) {
        setUser(result);
        return true;
      }
      return false;
    },
    []
  );

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    window.location.reload();
  }, []);

  const isWarehouse = user?.franchise?.isWarehouse === 1;

  return { user, isLoading, login, logout, isWarehouse };
}
