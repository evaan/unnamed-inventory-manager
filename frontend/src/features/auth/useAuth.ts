import { useCallback, useEffect, useState } from "react";
import { type AuthState, whoAmI, login, logout } from "./auth";

const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS === "true";

const DEV_USER: AuthState = {
  loggedIn: true,
  name: "Dev User",
  email: "dev@example.com",
  permissions: ["Administrator"],
};

export function useAuth() {
  const [auth, setAuth] = useState<AuthState | null>(DEV_BYPASS ? DEV_USER : null);

  const refresh = useCallback(async () => {
    if (DEV_BYPASS) return;
    setAuth(await whoAmI());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = async () => {
    if (DEV_BYPASS) return;
    await logout();
    await refresh();
  };

  return { auth, loading: auth === null, login, logout: signOut, refresh };
}