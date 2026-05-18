"use client";

import React from "react";
import { RequestCard } from "../shared/RequestCard";
import { useManagerAction } from "@/hooks/use-manager-action";
import type { Balance, TimeOffRequest } from "@/types";

interface RequestWithBalance {
  request: TimeOffRequest;
  balance: Balance | null;
}

interface Props {
  requestsWithBalances: RequestWithBalance[];
}

export function ManagerClient({ requestsWithBalances }: Props) {
  const { actingId, isPending, actionError, handleApprove, handleDeny } =
    useManagerAction();

  if (requestsWithBalances.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-gray-200 py-12 text-center"
        data-testid="empty-pending"
      >
        <p className="text-sm text-gray-400">No pending requests.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          data-testid="action-error"
          role="alert"
        >
          {actionError}
        </p>
      )}
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
  );
}
