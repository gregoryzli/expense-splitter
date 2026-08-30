import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Distinguishes "haven't checked the session cookie yet" from "checked,
  // no session" -- without it, App briefly flashes the login page on every
  // refresh before /auth/me resolves.
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    api
      .get("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const loggedInUser = await api.post("/auth/login", { email, password });
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const newUser = await api.post("/auth/register", { name, email, password });
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async (password) => {
    await api.delete("/auth/me", { password });
    setUser(null);
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await api.patch("/auth/password", { currentPassword, newPassword });
  }, []);

  return (
    <AuthContext.Provider value={{ user, checkingSession, login, register, logout, deleteAccount, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
