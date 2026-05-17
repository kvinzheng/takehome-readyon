"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

/**
 * Wrap the app in SessionProvider so any Client Component can call
 * useSession() to read login data without prop-drilling.
 *
 * Accepts `session` from the Server Component layout so the provider
 * is pre-seeded — useAuth() starts as "authenticated" immediately with
 * no loading flicker.
 *
 * Server Components should still use auth() directly — it reads the
 * JWT cookie without a network round-trip and is always preferred there.
 */
export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
