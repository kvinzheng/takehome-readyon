"use client";

import React, { useState, useTransition } from "react";
import { RequestCard } from "../shared/RequestCard";
import { approveTimeOff, denyTimeOff } from "@/app/actions";
import type { Balance, TimeOffRequest } from "@/types";

interface RequestWithBalance {
  request: TimeOffRequest;
  balance: Balance | null;
}

interface Props {
  requestsWithBalances: RequestWithBalance[];
}

export function ManagerClient({ requestsWithBalances }: Props) {
  const [isPending, startTransition] = useTransition();
  const [actingId, setActingId] = useState<string | null>(null);

  function handleApprove(id: string) {
    setActingId(id);
    startTransition(async () => {
      await approveTimeOff(id);
      setActingId(null);
    });
  }

  function handleDeny(id: string) {
    setActingId(id);
    startTransition(async () => {
      await denyTimeOff(id);
      setActingId(null);
    });
  }

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
