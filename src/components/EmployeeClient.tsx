"use client";

import React, { useState, useOptimistic, useTransition } from "react";
import { BalanceCard } from "./BalanceCard";
import { TimeOffForm } from "./TimeOffForm";
import { RequestCard } from "./RequestCard";
import { SuccessBanner, ErrorBanner } from "./StatusBanners";
import { submitTimeOff } from "@/app/actions";
import type { Balance, TimeOffRequest } from "@/types";

interface Props {
  employeeId: string;
  initialBalances: Balance[];
  initialRequests: TimeOffRequest[];
}

export function EmployeeClient({ employeeId, initialBalances, initialRequests }: Props) {
  const [isPending, startTransition] = useTransition();
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

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleSubmit(payload: {
    locationId: string;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
  }) {
    setSubmitError(null);
    setSuccessMsg(null);

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
      }
    });
  }

  return (
    <>
      {/* Balances */}
      <section aria-label="Balance overview" className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Available Balance
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {optimisticBalances.map((b) => (
            <BalanceCard
              key={`${b.employeeId}-${b.locationId}`}
              balance={b}
              isOptimistic={isPending}
            />
          ))}
        </div>
      </section>

      {/* Request form */}
      <section aria-label="Submit a request" className="mb-8">
        {successMsg && (
          <div className="mb-4">
            <SuccessBanner message={successMsg} />
          </div>
        )}
        {optimisticBalances.length > 0 && (
          <TimeOffForm
            employeeId={employeeId}
            balances={optimisticBalances}
            onSubmit={handleSubmit}
            isSubmitting={isPending}
            error={submitError}
          />
        )}
      </section>

      {/* Request history */}
      <section aria-label="My requests">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          My Requests
        </h2>
        {initialRequests.length === 0 && (
          <p className="text-sm text-gray-400" data-testid="empty-requests">
            No requests yet.
          </p>
        )}
        <div className="space-y-3">
          {initialRequests.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </div>
      </section>
    </>
  );
}
