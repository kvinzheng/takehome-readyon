/**
 * HCM API client — thin fetch wrappers consumed by TanStack Query hooks.
 * All functions throw on non-2xx so TanStack Query can surface them as errors.
 */

import type {
  HcmBalanceResponse,
  HcmBatchResponse,
  HcmSubmitRequestBody,
  HcmSubmitRequestResponse,
  HcmApprovalResponse,
  TimeOffRequest,
} from "@/types";

const BASE = "/api/hcm";

async function apiFetch<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Balance reads ────────────────────────────────────────────────────────────

export function fetchBalance(
  employeeId: string,
  locationId: string
): Promise<HcmBalanceResponse> {
  return apiFetch(
    `${BASE}/balance?employeeId=${encodeURIComponent(employeeId)}&locationId=${encodeURIComponent(locationId)}`
  );
}

export function fetchBatchBalances(): Promise<HcmBatchResponse> {
  return apiFetch(`${BASE}/balances/batch`);
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export function submitTimeOffRequest(
  body: HcmSubmitRequestBody,
  scenario?: string
): Promise<HcmSubmitRequestResponse> {
  return apiFetch(`${BASE}/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(scenario ? { "x-hcm-scenario": scenario } : {}),
    },
    body: JSON.stringify(body),
  });
}

export function fetchRequests(employeeId?: string): Promise<{ requests: TimeOffRequest[] }> {
  const qs = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : "";
  return apiFetch(`${BASE}/requests${qs}`);
}

export function fetchRequest(id: string): Promise<TimeOffRequest> {
  return apiFetch(`${BASE}/requests/${encodeURIComponent(id)}`);
}

export function approveRequest(id: string): Promise<HcmApprovalResponse> {
  return apiFetch(`${BASE}/requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve" }),
  });
}

export function denyRequest(id: string): Promise<HcmApprovalResponse> {
  return apiFetch(`${BASE}/requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "deny" }),
  });
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

export function triggerAnniversaryBonus(
  employeeId: string,
  locationId: string
): Promise<{ message: string; balance?: HcmBalanceResponse }> {
  return apiFetch(`${BASE}/anniversary-bonus`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, locationId }),
  });
}
