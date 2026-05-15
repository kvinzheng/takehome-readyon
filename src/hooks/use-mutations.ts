/**
 * Mutation hooks for the time-off request lifecycle.
 *
 * These hooks handle only the async API call and loading state.
 * The optimistic update contract (snapshot → apply → rollback → reconcile)
 * is managed by the caller (employee/page.tsx) using the callbacks exposed
 * by useEmployeeBalances — keeping cache logic co-located with cache ownership.
 */

import { useState } from "react";
import {
  submitTimeOffRequest,
  approveRequest,
  denyRequest,
} from "@/lib/hcm-api";
import type { HcmSubmitRequestBody, HcmSubmitRequestResponse } from "@/types";

// ─── Submit time-off ─────────────────────────────────────────────────────────

export function useSubmitTimeOff() {
  const [isPending, setIsPending] = useState(false);

  async function mutateAsync({
    body,
    scenario,
  }: {
    body: HcmSubmitRequestBody;
    scenario?: string;
  }): Promise<HcmSubmitRequestResponse> {
    setIsPending(true);
    try {
      return await submitTimeOffRequest(body, scenario);
    } finally {
      setIsPending(false);
    }
  }

  return { mutateAsync, isPending };
}

// ─── Manager approve / deny ───────────────────────────────────────────────────

export function useApproveRequest() {
  const [isPending, setIsPending] = useState(false);

  async function mutate(requestId: string) {
    setIsPending(true);
    try {
      return await approveRequest(requestId);
    } finally {
      setIsPending(false);
    }
  }

  return { mutate, isPending };
}

export function useDenyRequest() {
  const [isPending, setIsPending] = useState(false);

  async function mutate(requestId: string) {
    setIsPending(true);
    try {
      return await denyRequest(requestId);
    } finally {
      setIsPending(false);
    }
  }

  return { mutate, isPending };
}
