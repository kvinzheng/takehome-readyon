"use client";

import React from "react";

interface Props {
  message?: string;
}

export function ErrorBanner({ message }: Props) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
      data-testid="error-banner"
    >
      <svg
        className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
          clipRule="evenodd"
        />
      </svg>
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

export function StaleWarning({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
      data-testid="stale-warning"
    >
      <p className="text-sm text-amber-800">
        Your balance may have been updated since this page loaded.
      </p>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="shrink-0 rounded-lg bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200"
          data-testid="refresh-btn"
        >
          Refresh
        </button>
      )}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
      data-testid="success-banner"
    >
      <svg
        className="h-5 w-5 shrink-0 text-emerald-500"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </svg>
      <p className="text-sm text-emerald-800">{message}</p>
    </div>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" data-testid="loading-skeleton" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-2xl bg-gray-100"
        />
      ))}
    </div>
  );
}
