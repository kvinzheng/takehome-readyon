"use client";

import React, { createContext, useContext } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { SessionUser } from "@/auth";

interface UserContextValue {
  user: SessionUser | null;
  isLoading: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return <UserContext.Provider value={auth}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within <UserProvider>");
  return ctx;
}
