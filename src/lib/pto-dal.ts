import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";

import {
  getBalance,
  getBalancesForEmployee,
  getRequestsForEmployee,
  getPendingRequests,
  getRequest,
  deductBalance,
  createRequest,
  updateRequestStatus,
  restoreBalance,
  grantAnniversaryBonus as storeGrantAnniversaryBonus,
  hasGrantedAnniversaryThisYear,
  isWorkAnniversary,
  EMPLOYEES,
  LOCATIONS,
} from "./pto-store";
import { emitBalanceUpdate } from "./sse-bus";

import type {
  Balance,
  TimeOffRequest,
  SubmitTimeOffPayload,
  TimeOffSubmissionResponse,
  ApprovalResponse,
} from "@/types";

function delay(min: number, max: number): Promise<void> {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

// ─── Cache tags ───────────────────────────────────────────────────────────────
// Single source of truth for cache tags. Used by:
//   - DAL reads (via unstable_cache below)
//   - Server Actions (via revalidateTag in actions.ts) to invalidate the right
//     slice after a mutation.
//
// The in-memory store changes on every mutation, so cached reads MUST be
// invalidated by tag — otherwise users see stale balances/queues. Every
// mutating Server Action revalidates the tags it touches; see actions.ts.

export const ptoTags = {
  balances: (employeeId: string) => `balances:${employeeId}` as const,
  pendingRequests: () => "requests:pending" as const,
  employeeRequests: (employeeId: string) => `requests:${employeeId}` as const,
};

// ─── Read APIs ────────────────────────────────────────────────────────────────
// Wrapped in unstable_cache so cached values are reused across requests until
// revalidateTag flushes them. Short revalidate windows act as a safety net in
// case a tag invalidation is ever missed.
//
// For functions that take arguments, unstable_cache is constructed inline per
// call because its `tags` option is a static array — the closure lets each
// invocation contribute a per-employee tag.

export async function dalGetBalance(
  employeeId: string,
  locationId: string
): Promise<Balance | null> {
  return unstable_cache(
    async () => {
      await delay(50, 150);
      return getBalance(employeeId, locationId) ?? null;
    },
    ["balance", employeeId, locationId],
    { tags: [ptoTags.balances(employeeId)], revalidate: 60 }
  )();
}

export async function dalGetEmployeeBalances(
  employeeId: string
): Promise<Balance[]> {
  return unstable_cache(
    async () => {
      await delay(50, 150);
      return getBalancesForEmployee(employeeId);
    },
    ["balances", employeeId],
    { tags: [ptoTags.balances(employeeId)], revalidate: 60 }
  )();
}

export async function dalGetEmployeeRequests(
  employeeId: string
): Promise<TimeOffRequest[]> {
  return unstable_cache(
    async () => {
      await delay(30, 100);
      return getRequestsForEmployee(employeeId);
    },
    ["employee-requests", employeeId],
    { tags: [ptoTags.employeeRequests(employeeId)], revalidate: 30 }
  )();
}

export const dalGetPendingRequests = unstable_cache(
  async (): Promise<TimeOffRequest[]> => {
    await delay(30, 100);
    return getPendingRequests();
  },
  ["pending-requests"],
  { tags: [ptoTags.pendingRequests()], revalidate: 30 }
);

export async function dalSubmitTimeOff(
  body: SubmitTimeOffPayload,
  scenario?: string
): Promise<TimeOffSubmissionResponse> {
  const validEmployee = EMPLOYEES.find((e) => e.id === body.employeeId);
  const validLocation = LOCATIONS.find((l) => l.id === body.locationId);

  if (!validEmployee || !validLocation) {
    throw new Error("Invalid employee or location");
  }

  await delay(100, 300);

  // Silent failure: appear to succeed but don't commit
  if (scenario === "silent_failure" || (!scenario && Math.random() < 0.05)) {
    return {
      requestId: `req-silent-${Date.now()}`,
      status: "silent_failure",
      message: "Request recorded",
    };
  }

  // Conflict: HCM rejects outright
  if (scenario === "conflict") {
    throw new Error("Request conflicts with an existing approved leave block");
  }

  const result = deductBalance(body.employeeId, body.locationId, body.days);
  if (!result.success) {
    throw new Error(result.error ?? "Insufficient balance");
  }

  const request = createRequest({
    employeeId: body.employeeId,
    locationId: body.locationId,
    startDate: body.startDate,
    endDate: body.endDate,
    days: body.days,
    reason: body.reason,
  });

  return {
    requestId: request.id,
    status: "accepted",
    message: "Request accepted",
    newBalance: result.balance,
  };
}

export async function dalApproveRequest(id: string): Promise<ApprovalResponse> {
  const request = getRequest(id);
  if (!request) throw new Error("Request not found");
  if (request.status !== "pending_approval") {
    throw new Error(`Request is already ${request.status}`);
  }

  await delay(80, 200);
  updateRequestStatus(id, "approved");
  const balance = getBalance(request.employeeId, request.locationId);
  return { requestId: id, employeeId: request.employeeId, status: "approved", balance };
}

export async function dalDenyRequest(id: string): Promise<ApprovalResponse> {
  const request = getRequest(id);
  if (!request) throw new Error("Request not found");
  if (request.status !== "pending_approval") {
    throw new Error(`Request is already ${request.status}`);
  }

  await delay(80, 200);
  restoreBalance(request.employeeId, request.locationId, request.days);
  updateRequestStatus(id, "denied");
  const balance = getBalance(request.employeeId, request.locationId);
  return { requestId: id, employeeId: request.employeeId, status: "denied", balance };
}

// ─── Anniversary bonus ────────────────────────────────────────────────────────
// Two triggers, same underlying store mutation:
//
//   1. Manager grants explicitly (admin override, any time)
//      → dalGrantAnniversaryBonus(employeeId) via Server Action
//
//   2. Auto-grant when an employee opens their dashboard on their anniversary
//      → maybeGrantAnniversaryOnLogin(employeeId) from employee page
//
// Both paths are idempotent per (employee, location, year). The store guards
// against duplicate grants — re-calls are safe and return granted=false.

export interface AnniversaryEligibility {
  employeeId: string;
  employeeName: string;
  hireDate: string;
  alreadyGrantedThisYear: boolean;
  isAnniversaryToday: boolean;
  primaryLocationId: string | null;
}

/**
 * Returns the per-employee anniversary status used by the manager UI.
 * Includes all known employees so a manager can always grant manually.
 */
export async function dalGetAnniversaryEligibility(): Promise<AnniversaryEligibility[]> {
  await delay(20, 60);
  return EMPLOYEES.map((emp) => {
    const balances = getBalancesForEmployee(emp.id);
    const primary = balances[0]?.locationId ?? null;
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      hireDate: emp.hireDate,
      isAnniversaryToday: isWorkAnniversary(emp.id),
      alreadyGrantedThisYear: primary
        ? hasGrantedAnniversaryThisYear(emp.id, primary)
        : false,
      primaryLocationId: primary,
    };
  });
}

/**
 * Manager-triggered grant. Grants on the employee's primary balance location.
 * Returns the location it landed on so the caller can emit SSE.
 */
export async function dalGrantAnniversaryBonus(
  employeeId: string
): Promise<{ granted: boolean; locationId?: string; bonus?: number }> {
  await delay(40, 120);
  const balances = getBalancesForEmployee(employeeId);
  const primary = balances[0]?.locationId;
  if (!primary) return { granted: false };
  const result = storeGrantAnniversaryBonus(employeeId, primary);
  if (!result.granted) return { granted: false };
  return { granted: true, locationId: primary, bonus: result.bonus };
}

/**
 * Auto-grant on employee dashboard load. Fires once per (employee, location, year)
 * via the store's idempotency guard. Invalidates the balance cache so the page
 * render that triggered this sees the new value, and emits SSE for other tabs.
 *
 * Called from src/app/employee/page.tsx before reading balances.
 */
export async function maybeGrantAnniversaryOnLogin(employeeId: string): Promise<void> {
  if (!isWorkAnniversary(employeeId)) return;

  let anyGranted = false;
  for (const loc of LOCATIONS) {
    const result = storeGrantAnniversaryBonus(employeeId, loc.id);
    if (result.granted) {
      anyGranted = true;
      emitBalanceUpdate({
        employeeId,
        locationId: loc.id,
        bonus: result.bonus ?? 0,
        reason: "anniversary",
      });
    }
  }

  if (anyGranted) {
    // Flush cached balance reads so this request sees the bonus.
    revalidateTag(ptoTags.balances(employeeId), "max");
  }
}
