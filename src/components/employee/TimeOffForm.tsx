"use client";

import React, { useState } from "react";
import type { BalanceApiResponse } from "@/types";

interface Props {
  balances: BalanceApiResponse[];
  onSubmit: (payload: {
    locationId: string;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
  }) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const diff = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24) + 1;
  return Math.max(0, diff);
}

export function TimeOffForm({
  balances,
  onSubmit,
  isSubmitting,
  error,
}: Props) {
  const [locationId, setLocationId] = useState(balances[0]?.locationId ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const days = calcDays(startDate, endDate);
  const selectedBalance = balances.find((b) => b.locationId === locationId);
  const insufficientBalance = selectedBalance
    ? days > selectedBalance.available
    : false;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (!locationId) return setValidationError("Select a location.");
    if (!startDate || !endDate) return setValidationError("Select dates.");
    if (new Date(endDate) < new Date(startDate))
      return setValidationError("End date must be after start date.");
    if (days < 1) return setValidationError("Must request at least 1 day.");
    if (insufficientBalance)
      return setValidationError(
        `Only ${selectedBalance?.available} days available for this location.`
      );

    onSubmit({ locationId, startDate, endDate, days, reason });
  }

  const displayError = validationError ?? error;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      data-testid="time-off-form"
      aria-label="Request time off"
    >
      <h2 className="mb-5 text-lg font-semibold text-gray-900">
        Request Time Off
      </h2>

      {/* Location */}
      <div className="mb-4">
        <label
          htmlFor="location"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Location
        </label>
        <select
          id="location"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          disabled={isSubmitting}
        >
          {balances.map((b) => (
            <option key={b.locationId} value={b.locationId}>
              {b.locationId.replace("loc-", "").toUpperCase()} —{" "}
              {b.available} days available
            </option>
          ))}
        </select>
      </div>

      {/* Dates */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="start-date"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Start date
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label
            htmlFor="end-date"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            End date
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Days preview */}
      {days > 0 && (
        <p
          className={`mb-3 text-sm ${
            insufficientBalance ? "text-red-600 font-medium" : "text-gray-500"
          }`}
          role="status"
        >
          {days} day{days !== 1 ? "s" : ""} selected
          {insufficientBalance && " — exceeds available balance"}
        </p>
      )}

      {/* Reason */}
      <div className="mb-5">
        <label
          htmlFor="reason"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Reason <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Vacation, personal day, etc."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          disabled={isSubmitting}
        />
      </div>

      {/* Error */}
      {displayError && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          data-testid="form-error"
        >
          {displayError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || insufficientBalance}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="submit-button"
      >
        {isSubmitting ? "Submitting…" : "Submit Request"}
      </button>
    </form>
  );
}
