"use client";

import { useSession } from "next-auth/react";
import type { SessionUser } from "@/auth";

export function useAuth(): { user: SessionUser | null; isLoading: boolean } {
  const { data: session, status } = useSession();
  return {
    user: status === "authenticated" ? (session.user as SessionUser) : null,
    isLoading: status === "loading",
  };
}
