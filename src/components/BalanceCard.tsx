"use client";

import React from "react";
import type { HcmBalanceResponse } from "@/types";

interface Props {
  balance: HcmBalanceResponse;
  isOptimistic?: boolean;
  isSyncing?: boolean;
  isStale?: boolean;
}

export function BalanceCard({ balance, isOptimistic, isSyncing, isStale }: Props) {
  const pct = balance.total > 0 ? (balance.available / balance.total) * 100 : 0;

  const ringColor =
    pct > 50
      ? "stroke-emerald-500"
      : pct > 25
      ? "stroke-amber-400"
      : "stroke-red-500";

  const circumference = 2 * Math.PI * 28; // r=28
  const dashoffset = circumference * (1 - pct / 100);

  return (
    <div
      className={`relative rounded-2xl border bg-white p-5 shadow-sm transition-all ${
        isOptimistic ? "border-amber-300 bg-amber-50" : "border-gray-200"
      } ${isStale ? "opacity-60" : ""}`}
      data-testid="balance-card"
      data-employee-id={balance.employeeId}
      data-location-id={balance.locationId}
    >
      {/* Status badges */}
      <div className="absolute right-3 top-3 flex gap-1">
        {isOptimistic && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Pending
          </span>
        )}
        {isSyncing && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 animate-pulse">
            Syncing…
          </span>
        )}
        {isStale && !isSyncing && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            Stale
          </span>
        )}
      </div>

      <div className="flex items-center gap-5">
        {/* Donut ring */}
        <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0 -rotate-90">
          <circle
            cx="36"
            cy="36"
            r="28"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          <circle
            cx="36"
            cy="36"
            r="28"
            fill="none"
            className={ringColor}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-500">
            {balance.locationId.replace("loc-", "").toUpperCase()}
          </p>
          <p className="text-3xl font-bold tabular-nums text-gray-900">
            {balance.available}
            <span className="ml-1 text-base font-normal text-gray-400">
              / {balance.total} days
            </span>
          </p>
          <p className="text-xs text-gray-400">
            {balance.used} used · as of{" "}
            {new Date(balance.asOf).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}
