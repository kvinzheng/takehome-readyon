/**
 * In-memory HCM store — the "source of truth" that mock route handlers
 * read from and write to.  Shared module singleton so all route handlers
 * within the same Next.js server process see consistent state.
 */

import type {
  Balance,
  Employee,
  Location,
  TimeOffRequest,
  RequestStatus,
} from "@/types";

// ─── Seed data ────────────────────────────────────────────────────────────────

export const EMPLOYEES: Employee[] = [
  {
    id: "emp-1",
    name: "Alice Johnson",
    email: "alice@acme.com",
    hireDate: "2020-03-15",
    managerId: "emp-3",
  },
  {
    id: "emp-2",
    name: "Bob Martinez",
    email: "bob@acme.com",
    hireDate: "2021-07-01",
    managerId: "emp-3",
  },
  {
    id: "emp-3",
    name: "Carol Chen",
    email: "carol@acme.com",
    hireDate: "2018-01-10",
    managerId: null,
  },
];

export const LOCATIONS: Location[] = [
  { id: "loc-us", name: "United States" },
  { id: "loc-eu", name: "Europe" },
  { id: "loc-apac", name: "Asia-Pacific" },
];

// ─── Mutable store ────────────────────────────────────────────────────────────

/** Keyed by `${employeeId}:${locationId}` */
const balanceStore = new Map<string, Balance>();

/** All time-off requests */
const requestStore = new Map<string, TimeOffRequest>();

/** Track anniversary bonus grants to avoid double-granting in same session */
const anniversaryGranted = new Set<string>();

function balanceKey(employeeId: string, locationId: string) {
  return `${employeeId}:${locationId}`;
}

// Seed balances
function seedBalances() {
  const seeds: Array<{ employeeId: string; locationId: string; available: number; used: number }> = [
    { employeeId: "emp-1", locationId: "loc-us", available: 10, used: 5 },
    { employeeId: "emp-1", locationId: "loc-eu", available: 3, used: 2 },
    { employeeId: "emp-2", locationId: "loc-us", available: 15, used: 0 },
    { employeeId: "emp-2", locationId: "loc-eu", available: 7, used: 3 },
    { employeeId: "emp-3", locationId: "loc-us", available: 20, used: 10 },
    { employeeId: "emp-3", locationId: "loc-apac", available: 5, used: 1 },
  ];

  for (const s of seeds) {
    const key = balanceKey(s.employeeId, s.locationId);
    balanceStore.set(key, {
      employeeId: s.employeeId,
      locationId: s.locationId,
      available: s.available,
      used: s.used,
      total: s.available + s.used,
      asOf: new Date().toISOString(),
    });
  }
}

seedBalances();

// ─── Public API ───────────────────────────────────────────────────────────────

export function getBalance(employeeId: string, locationId: string): Balance | undefined {
  return balanceStore.get(balanceKey(employeeId, locationId));
}

export function getAllBalances(): Balance[] {
  return Array.from(balanceStore.values());
}

export function getBalancesForEmployee(employeeId: string): Balance[] {
  return getAllBalances().filter((b) => b.employeeId === employeeId);
}

export function deductBalance(
  employeeId: string,
  locationId: string,
  days: number
): { success: boolean; error?: string; balance?: Balance } {
  const key = balanceKey(employeeId, locationId);
  const current = balanceStore.get(key);

  if (!current) {
    return { success: false, error: "Invalid employee/location combination" };
  }
  if (current.available < days) {
    return {
      success: false,
      error: `Insufficient balance: ${current.available} days available, ${days} requested`,
    };
  }

  const updated: Balance = {
    ...current,
    available: current.available - days,
    used: current.used + days,
    asOf: new Date().toISOString(),
  };
  balanceStore.set(key, updated);
  return { success: true, balance: updated };
}

export function restoreBalance(
  employeeId: string,
  locationId: string,
  days: number
): void {
  const key = balanceKey(employeeId, locationId);
  const current = balanceStore.get(key);
  if (!current) return;
  balanceStore.set(key, {
    ...current,
    available: current.available + days,
    used: Math.max(0, current.used - days),
    asOf: new Date().toISOString(),
  });
}

/** Returns true if today is the employee's work anniversary (month+day match). */
export function isWorkAnniversary(employeeId: string): boolean {
  const employee = EMPLOYEES.find((e) => e.id === employeeId);
  if (!employee) return false;
  const hire = new Date(employee.hireDate);
  const today = new Date();
  return hire.getMonth() === today.getMonth() && hire.getDate() === today.getDate();
}

function grantKey(employeeId: string, locationId: string): string {
  return `${employeeId}:${locationId}:${new Date().getFullYear()}`;
}

/** Has this employee already received an anniversary bonus for this location in the current calendar year? */
export function hasGrantedAnniversaryThisYear(
  employeeId: string,
  locationId: string
): boolean {
  return anniversaryGranted.has(grantKey(employeeId, locationId));
}

/** Fire a work-anniversary bonus (+5 days) for an employee+location pair. Idempotent per calendar year. */
export function grantAnniversaryBonus(
  employeeId: string,
  locationId: string
): { granted: boolean; balance?: Balance; bonus?: number } {
  const gKey = grantKey(employeeId, locationId);
  if (anniversaryGranted.has(gKey)) {
    return { granted: false };
  }
  const key = balanceKey(employeeId, locationId);
  const current = balanceStore.get(key);
  if (!current) return { granted: false };

  const bonus = 5;
  const updated: Balance = {
    ...current,
    available: current.available + bonus,
    total: current.total + bonus,
    asOf: new Date().toISOString(),
  };
  balanceStore.set(key, updated);
  anniversaryGranted.add(gKey);
  return { granted: true, balance: updated, bonus };
}

// ─── Request store ────────────────────────────────────────────────────────────

export function getRequest(id: string): TimeOffRequest | undefined {
  return requestStore.get(id);
}

export function getAllRequests(): TimeOffRequest[] {
  return Array.from(requestStore.values());
}

export function getRequestsForEmployee(employeeId: string): TimeOffRequest[] {
  return getAllRequests().filter((r) => r.employeeId === employeeId);
}

export function getPendingRequests(): TimeOffRequest[] {
  return getAllRequests().filter((r) => r.status === "pending_approval");
}

export function createRequest(
  data: Omit<TimeOffRequest, "id" | "createdAt" | "updatedAt" | "status">
): TimeOffRequest {
  const request: TimeOffRequest = {
    ...data,
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "pending_approval",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  requestStore.set(request.id, request);
  return request;
}

export function updateRequestStatus(
  id: string,
  status: RequestStatus,
  hcmError?: string
): TimeOffRequest | undefined {
  const request = requestStore.get(id);
  if (!request) return undefined;
  const updated: TimeOffRequest = {
    ...request,
    status,
    ptoError: hcmError,
    updatedAt: new Date().toISOString(),
  };
  requestStore.set(id, updated);
  return updated;
}

export function resetStore() {
  balanceStore.clear();
  requestStore.clear();
  anniversaryGranted.clear();
  seedBalances();
}
