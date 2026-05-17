"use client";

import React from "react";
import type { TimeOffRequest, BalanceApiResponse } from "@/types";
import { format } from "date-fns";

interface Props {
  request: TimeOffRequest;
  balance?: BalanceApiResponse;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
  isActing?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  pending_approval: "bg-yellow-100 text-yellow-800",
  approved: "bg-emerald-100 text-emerald-800",
  denied: "bg-red-100 text-red-800",
  rolled_back: "bg-gray-100 text-gray-600",
  pending_submission: "bg-blue-100 text-blue-800",
};

export function RequestCard({
  request,
  balance,
  onApprove,
  onDeny,
  isActing,
}: Props) {
  const canAct =
    request.status === "pending_approval" && (onApprove || onDeny);

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      data-testid="request-card"
      data-request-id={request.id}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {format(new Date(request.startDate), "MMM d")} –{" "}
            {format(new Date(request.endDate), "MMM d, yyyy")}
          </p>
          <p className="text-xs text-gray-500">
            {request.days} day{request.days !== 1 ? "s" : ""} ·{" "}
            {request.locationId.replace("loc-", "").toUpperCase()}
          </p>
          {request.reason && (
            <p className="mt-1 text-xs text-gray-400 italic">{request.reason}</p>
          )}
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
            STATUS_STYLES[request.status] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {request.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Balance context for manager view */}
      {balance && (
        <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">
            Current balance:{" "}
            <span className="font-semibold text-gray-800">
              {balance.available} / {balance.total} days
            </span>{" "}
            <span className="text-gray-400">
              (as of {new Date(balance.asOf).toLocaleTimeString()})
            </span>
          </p>
        </div>
      )}

      {request.ptoError && (
        <p
          role="alert"
          className="mt-2 text-xs text-red-600"
          data-testid="pto-error"
        >
          PTO: {request.ptoError}
        </p>
      )}

      {/* Manager actions */}
      {canAct && (
        <div className="mt-4 flex gap-2">
          {onApprove && (
            <button
              onClick={() => onApprove(request.id)}
              disabled={isActing}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              data-testid="approve-btn"
            >
              Approve
            </button>
          )}
          {onDeny && (
            <button
              onClick={() => onDeny(request.id)}
              disabled={isActing}
              className="flex-1 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
              data-testid="deny-btn"
            >
              Deny
            </button>
          )}
        </div>
      )}
    </div>
  );
}
