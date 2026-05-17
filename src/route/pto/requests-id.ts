import {
  getRequest,
  updateRequestStatus,
  restoreBalance,
  getBalance,
} from "@/lib/pto-store";
import type { ApprovalResponse, TimeOffRequest } from "@/types";
import { ValidationError, NotFoundError, ConflictError } from "./errors";

export async function updateRequestHandler(
  id: string,
  action: string
): Promise<ApprovalResponse> {
  if (!["approve", "deny"].includes(action)) {
    throw new ValidationError("action must be 'approve' or 'deny'");
  }

  const request = getRequest(id);
  if (!request) {
    throw new NotFoundError("Request not found");
  }
  if (request.status !== "pending_approval") {
    throw new ConflictError(`Request is already ${request.status}`);
  }

  await new Promise((r) => setTimeout(r, 80 + Math.random() * 120));

  if (action === "deny") {
    restoreBalance(request.employeeId, request.locationId, request.days);
    updateRequestStatus(id, "denied");
  } else {
    updateRequestStatus(id, "approved");
  }

  const balance = getBalance(request.employeeId, request.locationId);
  return {
    requestId: id,
    status: action === "approve" ? "approved" : "denied",
    balance,
  };
}

export function getRequestByIdHandler(id: string): TimeOffRequest {
  const request = getRequest(id);
  if (!request) {
    throw new NotFoundError("Request not found");
  }
  return request;
}
