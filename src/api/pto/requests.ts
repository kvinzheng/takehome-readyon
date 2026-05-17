import {
  deductBalance,
  createRequest,
  EMPLOYEES,
  LOCATIONS,
  getAllRequests,
  getRequestsForEmployee,
} from "@/lib/pto-store";
import type {
  SubmitTimeOffPayload,
  TimeOffSubmissionResponse,
  TimeOffRequest,
} from "@/types";
import { ValidationError, ConflictError, InsufficientBalanceError } from "./errors";

export async function submitRequestHandler(
  body: SubmitTimeOffPayload,
  scenario: string | null
): Promise<TimeOffSubmissionResponse> {
  const validEmployee = EMPLOYEES.find((e) => e.id === body.employeeId);
  const validLocation = LOCATIONS.find((l) => l.id === body.locationId);

  if (!validEmployee || !validLocation) {
    throw new ValidationError("Invalid employee or location");
  }

  await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

  if (scenario === "silent_failure" || (!scenario && Math.random() < 0.05)) {
    return {
      requestId: `req-silent-${Date.now()}`,
      status: "silent_failure",
      message: "Request recorded",
    };
  }

  if (scenario === "conflict") {
    throw new ConflictError("Request conflicts with an existing approved leave block");
  }

  const result = deductBalance(body.employeeId, body.locationId, body.days);
  if (!result.success) {
    throw new InsufficientBalanceError(result.error ?? "Insufficient balance");
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
    message: "Request submitted successfully",
    newBalance: result.balance,
  };
}

export function getRequestsHandler(
  employeeId: string | null
): { requests: TimeOffRequest[] } {
  const requests = employeeId
    ? getRequestsForEmployee(employeeId)
    : getAllRequests();
  return { requests };
}
