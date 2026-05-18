"use client";

import { useState, useTransition } from "react";
import { approveTimeOff, denyTimeOff } from "@/app/actions";

interface UseManagerActionReturn {
  actingId: string | null;
  isPending: boolean;
  actionError: string | null;
  handleApprove: (id: string) => void;
  handleDeny: (id: string) => void;
}

/**
 * Encapsulates manager approve/deny lifecycle:
 *  - Tracks which row is currently being acted on (actingId)
 *  - Surfaces server-action errors via actionError instead of silently swallowing
 *  - Pessimistic by design — we never optimistically mark a request approved;
 *    a wrong "approved" is not safely recoverable.
 */
export function useManagerAction(): UseManagerActionReturn {
  const [isPending, startTransition] = useTransition();
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function run(id: string, action: (id: string) => Promise<unknown>) {
    setActionError(null);
    setActingId(id);
    startTransition(async () => {
      try {
        await action(id);
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Action failed. Please try again."
        );
      } finally {
        setActingId(null);
      }
    });
  }

  return {
    actingId,
    isPending,
    actionError,
    handleApprove: (id) => run(id, approveTimeOff),
    handleDeny: (id) => run(id, denyTimeOff),
  };
}
