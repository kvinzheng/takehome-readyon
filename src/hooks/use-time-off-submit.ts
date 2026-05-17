"use client";

import { useState, useOptimistic, useTransition } from "react";
import { submitTimeOff } from "@/app/actions";
import type { Balance } from "@/types";

interface SubmitPayload {
  locationId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
}

interface UseTimeOffSubmitReturn {
  optimisticBalances: Balance[];
  isSubmitting: boolean;
  successMsg: string | null;
  submitError: string | null;
  handleSubmit: (payload: SubmitPayload) => void;
}

/**
 * Encapsulates the full time-off submission flow:
 *  - Optimistic balance deduction (reverts automatically on error)
 *  - Silent-failure detection (200 OK but no PTO commitment)
 *  - Success / error messaging
 *  - isSubmitting flag that resets synchronously in finally (safe in jsdom)
 */
export function useTimeOffSubmit(
  employeeId: string,
  initialBalances: Balance[]
): UseTimeOffSubmitReturn {
  const [, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [optimisticBalances, applyOptimistic] = useOptimistic(
    initialBalances,
    (
      current: Balance[],
      { locationId, days }: { locationId: string; days: number }
    ) =>
      current.map((b) =>
        b.employeeId === employeeId && b.locationId === locationId
          ? {
              ...b,
              available: Math.max(0, b.available - days),
              asOf: new Date().toISOString(),
            }
          : b
      )
  );

  function handleSubmit(payload: SubmitPayload) {
    setSubmitError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    startTransition(async () => {
      applyOptimistic({ locationId: payload.locationId, days: payload.days });
      try {
        const result = await submitTimeOff(payload);
        if (result.status === "silent_failure") {
          setSubmitError(
            "Your request was received but the PTO system has not confirmed it yet. " +
              "Please check back in a few minutes."
          );
        } else {
          setSuccessMsg(
            `Request submitted for ${payload.days} day${payload.days !== 1 ? "s" : ""}. Awaiting manager approval.`
          );
        }
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Submission failed. Please try again."
        );
      } finally {
        setIsSubmitting(false);
      }
    });
  }

  return { optimisticBalances, isSubmitting, successMsg, submitError, handleSubmit };
}
