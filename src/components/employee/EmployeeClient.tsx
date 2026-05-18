"use client";

import React, { useEffect } from "react";
import { BalanceCard } from "./BalanceCard";
import { TimeOffForm } from "./TimeOffForm";
import { RequestCard } from "../shared/RequestCard";
import { SuccessBanner, ErrorBanner, StaleWarning } from "../shared/StatusBanners";
import { useTimeOffSubmit } from "@/hooks/use-time-off-submit";
import { useSSESync } from "@/hooks/use-sse-sync";
import { useUser } from "@/context/UserContext";
import type { Balance, TimeOffRequest } from "@/types";

interface Props {
  initialBalances: Balance[];
  initialRequests: TimeOffRequest[];
}

export function EmployeeClient({ initialBalances, initialRequests }: Props) {
  const { isStale, clearStale, refresh } = useSSESync();
  const { user } = useUser();

  // When the server re-renders with fresh data (initialBalances prop changes
  // after router.refresh()), mark the displayed balances as current again.
  useEffect(() => {
    clearStale();
  }, [initialBalances, clearStale]);

  const { optimisticBalances, isSubmitting, successMsg, submitError, handleSubmit } =
    useTimeOffSubmit(user?.id ?? "", initialBalances);

  return (
    <>
      {/* Stale-data warning — shown when SSE fires until fresh props arrive */}
      {isStale && (
        <div className="mb-4">
          <StaleWarning onRefresh={refresh} />
        </div>
      )}

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
              isOptimistic={isSubmitting}
              isStale={isStale}
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
            balances={optimisticBalances}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
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
