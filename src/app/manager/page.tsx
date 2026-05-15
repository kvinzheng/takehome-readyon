"use client";

import React from "react";
import { usePendingRequests } from "@/hooks/use-requests";
import { useApproveRequest, useDenyRequest } from "@/hooks/use-mutations";
import { useBalance } from "@/hooks/use-balances";
import { RequestCard } from "@/components/RequestCard";
import { LoadingSkeleton, ErrorBanner } from "@/components/StatusBanners";
import type { TimeOffRequest } from "@/types";

function RequestWithBalance({
  request,
  onApprove,
  onDeny,
  isActing,
}: {
  request: TimeOffRequest;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  isActing: boolean;
}) {
  // Fetch real-time balance snapshot at decision time — this is the key
  // guarantee for managers: the balance shown is authoritative, not cached.
  const balanceQuery = useBalance(request.employeeId, request.locationId);

  return (
    <RequestCard
      request={request}
      balance={balanceQuery.data}
      onApprove={onApprove}
      onDeny={onDeny}
      isActing={isActing}
    />
  );
}

export default function ManagerView() {
  const pendingQuery = usePendingRequests();
  const approveMutation = useApproveRequest();
  const denyMutation = useDenyRequest();

  const isActing = approveMutation.isPending || denyMutation.isPending;

  async function handleApprove(id: string) {
    await approveMutation.mutate(id);
    pendingQuery.refresh();
  }

  async function handleDeny(id: string) {
    await denyMutation.mutate(id);
    pendingQuery.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10" data-testid="manager-view">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
        <p className="text-sm text-gray-500">
          Carol Chen · Manager — balances shown are live HCM reads
        </p>
      </header>

      {pendingQuery.isLoading && <LoadingSkeleton rows={3} />}
      {pendingQuery.error && (
        <ErrorBanner message="Unable to load pending requests. Please refresh." />
      )}

      {pendingQuery.data?.length === 0 && !pendingQuery.isLoading && (
        <div
          className="rounded-2xl border border-dashed border-gray-200 py-12 text-center"
          data-testid="empty-pending"
        >
          <p className="text-sm text-gray-400">No pending requests.</p>
        </div>
      )}

      <div className="space-y-4">
        {pendingQuery.data?.map((request) => (
          <RequestWithBalance
            key={request.id}
            request={request}
            onApprove={handleApprove}
            onDeny={handleDeny}
            isActing={isActing}
          />
        ))}
      </div>
    </div>
  );
}
