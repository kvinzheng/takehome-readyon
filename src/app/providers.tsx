"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";

/**
 * Wrap the app in SessionProvider so any Client Component can call
 * useSession() to read login data without prop-drilling.
 *
 * Server Components should still use auth() directly — it reads the
 * JWT cookie without a network round-trip and is always preferred there.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
