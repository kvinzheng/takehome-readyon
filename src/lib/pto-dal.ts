import "server-only";

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
  EMPLOYEES,
  LOCATIONS,
} from "./pto-store";

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

export async function dalGetBalance(
  employeeId: string,
  locationId: string
): Promise<Balance | null> {
  await delay(50, 150);
  return getBalance(employeeId, locationId) ?? null;
}

export async function dalGetEmployeeBalances(employeeId: string): Promise<Balance[]> {
  await delay(50, 150);
  return getBalancesForEmployee(employeeId);
}

export async function dalGetEmployeeRequests(employeeId: string): Promise<TimeOffRequest[]> {
  await delay(30, 100);
  return getRequestsForEmployee(employeeId);
}

export async function dalGetPendingRequests(): Promise<TimeOffRequest[]> {
  await delay(30, 100);
  return getPendingRequests();
}

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
  return { requestId: id, status: "approved", balance };
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
  return { requestId: id, status: "denied", balance };
}
