"use client";

import { useState, useTransition } from "react";
import { grantAnniversaryBonus } from "@/app/actions";

interface UseAnniversaryGrantReturn {
  grantingId: string | null;
  isPending: boolean;
  error: string | null;
  handleGrant: (employeeId: string) => void;
}

/**
 * Manager-side handler for granting an anniversary bonus to an employee.
 * Mirrors `useManagerAction` shape: track who's being acted on, surface
 * errors, and rely on `revalidateTag` inside the Server Action to refresh
 * the manager's eligibility panel.
 */
export function useAnniversaryGrant(): UseAnniversaryGrantReturn {
  const [isPending, startTransition] = useTransition();
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleGrant(employeeId: string) {
    setError(null);
    setGrantingId(employeeId);
    startTransition(async () => {
      try {
        await grantAnniversaryBonus(employeeId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Grant failed.");
      } finally {
        setGrantingId(null);
      }
    });
  }

  return { grantingId, isPending, error, handleGrant };
}
