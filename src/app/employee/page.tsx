"use client";

import React, { useState } from "react";
import { useEmployeeBalances } from "@/hooks/use-balances";
import { useRequests } from "@/hooks/use-requests";
import { useSubmitTimeOff } from "@/hooks/use-mutations";
import { BalanceCard } from "@/components/BalanceCard";
import { TimeOffForm } from "@/components/TimeOffForm";
import { RequestCard } from "@/components/RequestCard";
import {
  LoadingSkeleton,
  ErrorBanner,
  StaleWarning,
  SuccessBanner,
} from "@/components/StatusBanners";

const DEMO_EMPLOYEE_ID = "emp-1";

export default function EmployeeView() {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const balancesQuery = useEmployeeBalances(DEMO_EMPLOYEE_ID);
  const requestsQuery = useRequests(DEMO_EMPLOYEE_ID);
  const submitMutation = useSubmitTimeOff();

  const isStale = balancesQuery.isStale && !balancesQuery.isFetching;
  const isSyncing = balancesQuery.isFetching;

  async function handleSubmit(payload: {
    locationId: string;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
  }) {
    setSubmitError(null);
    setSuccessMsg(null);

    // 1. Cancel any in-flight background fetch to prevent it overwriting
    //    our optimistic update mid-flight.
    balancesQuery.cancelFetch();

    // 2. Apply optimistic deduction immediately.
    balancesQuery.applyOptimistic((prev) => ({
      ...prev,
      balances: prev.balances.map((b) =>
        b.employeeId === DEMO_EMPLOYEE_ID && b.locationId === payload.locationId
          ? {
              ...b,
              available: Math.max(0, b.available - payload.days),
              used: b.used + payload.days,
              asOf: new Date().toISOString(),
            }
          : b
      ),
    }));

    try {
      const result = await submitMutation.mutateAsync({
        body: {
          employeeId: DEMO_EMPLOYEE_ID,
          ...payload,
        },
      });

      if (result.status === "silent_failure") {
        // HCM said "ok" but we know it didn't commit — surface a warning
        setSubmitError(
          "Your request was received but HCM has not confirmed it yet. " +
            "Please check back in a few minutes."
        );
      } else {
        setSuccessMsg(
          `Request submitted for ${payload.days} day${payload.days !== 1 ? "s" : ""}. Awaiting manager approval.`
        );
      }
    } catch (err: unknown) {
      // 3. Roll back the optimistic update on error.
      balancesQuery.rollback();
      setSubmitError(
        err instanceof Error ? err.message : "Submission failed. Please try again."
      );
    } finally {
      // 4. Always reconcile with HCM — catches silent failures.
      balancesQuery.refresh();
      requestsQuery.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10" data-testid="employee-view">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Time Off</h1>
        <p className="text-sm text-gray-500">
          Alice Johnson · Balances sourced from HCM
        </p>
      </header>

      {/* Stale data warning */}
      {isStale && (
        <div className="mb-5">
          <StaleWarning onRefresh={balancesQuery.refresh} />
        </div>
      )}

      {/* Balances */}
      <section aria-label="Balance overview" className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Available Balance
        </h2>
        {balancesQuery.isLoading && <LoadingSkeleton rows={2} />}
        {balancesQuery.error && (
          <ErrorBanner message="Unable to load balances. Please refresh." />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {balancesQuery.data?.map((b) => (
            <BalanceCard
              key={`${b.employeeId}-${b.locationId}`}
              balance={b}
              isOptimistic={submitMutation.isPending}
              isSyncing={isSyncing}
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
        {balancesQuery.data && balancesQuery.data.length > 0 && (
          <TimeOffForm
            employeeId={DEMO_EMPLOYEE_ID}
            balances={balancesQuery.data}
            onSubmit={handleSubmit}
            isSubmitting={submitMutation.isPending}
            error={submitError}
          />
        )}
      </section>

      {/* Request history */}
      <section aria-label="My requests">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          My Requests
        </h2>
        {requestsQuery.isLoading && <LoadingSkeleton rows={2} />}
        {requestsQuery.data?.length === 0 && (
          <p className="text-sm text-gray-400" data-testid="empty-requests">
            No requests yet.
          </p>
        )}
        <div className="space-y-3">
          {requestsQuery.data?.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </div>
      </section>
    </div>
  );
}
