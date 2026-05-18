"use client";

import React from "react";
import { RequestCard } from "../shared/RequestCard";
import { useManagerAction } from "@/hooks/use-manager-action";
import { useAnniversaryGrant } from "@/hooks/use-anniversary-grant";
import { useSSESync } from "@/hooks/use-sse-sync";
import type { Balance, TimeOffRequest } from "@/types";
import type { AnniversaryEligibility } from "@/lib/pto-dal";

interface RequestWithBalance {
  request: TimeOffRequest;
  balance: Balance | null;
}

interface Props {
  requestsWithBalances: RequestWithBalance[];
  anniversaryEligibility: AnniversaryEligibility[];
}

export function ManagerClient({ requestsWithBalances, anniversaryEligibility }: Props) {
  // Subscribe to PTO updates so an employee submitting in another tab makes
  // the manager's queue appear without manual refresh. The hook calls
  // router.refresh() internally on every pto-update frame.
  useSSESync();

  const { actingId, isPending, actionError, handleApprove, handleDeny } =
    useManagerAction();
  const {
    grantingId,
    isPending: isGranting,
    error: grantError,
    handleGrant,
  } = useAnniversaryGrant();

  return (
    <div className="space-y-10">
      {/* ── Pending approvals ─────────────────────────────────────────── */}
      <section aria-label="Pending approvals">
        {actionError && (
          <p
            className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            data-testid="action-error"
            role="alert"
          >
            {actionError}
          </p>
        )}
        {requestsWithBalances.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed border-gray-200 py-12 text-center"
            data-testid="empty-pending"
          >
            <p className="text-sm text-gray-400">No pending requests.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requestsWithBalances.map(({ request, balance }) => (
              <RequestCard
                key={request.id}
                request={request}
                balance={balance ?? undefined}
                onApprove={handleApprove}
                onDeny={handleDeny}
                isActing={actingId === request.id && isPending}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Anniversary bonuses ───────────────────────────────────────── */}
      <section aria-label="Anniversary bonuses" data-testid="anniversary-panel">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Anniversary bonuses
        </h2>
        {grantError && (
          <p
            className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            data-testid="grant-error"
            role="alert"
          >
            {grantError}
          </p>
        )}
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
          {anniversaryEligibility.map((emp) => {
            const isThisGranting = grantingId === emp.employeeId && isGranting;
            const disabled = emp.alreadyGrantedThisYear || isThisGranting;
            return (
              <li
                key={emp.employeeId}
                className="flex items-center justify-between gap-4 px-4 py-3"
                data-testid={`anniversary-row-${emp.employeeId}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{emp.employeeName}</p>
                  <p className="text-xs text-gray-500">
                    Hired {emp.hireDate}
                    {emp.isAnniversaryToday && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                        Anniversary today
                      </span>
                    )}
                    {emp.alreadyGrantedThisYear && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                        Granted this year
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleGrant(emp.employeeId)}
                  data-testid={`grant-bonus-${emp.employeeId}`}
                  className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isThisGranting ? "Granting…" : "Grant +5 days"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
