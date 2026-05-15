// ─── Domain Types ───────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  name: string;
  email: string;
  hireDate: string; // ISO date
  managerId: string | null;
}

export interface Location {
  id: string;
  name: string;
}

/** A single balance cell: per-employee, per-location */
export interface Balance {
  employeeId: string;
  locationId: string;
  available: number; // days
  used: number;
  total: number;
  asOf: string; // ISO timestamp from HCM
}

// ─── Request Lifecycle ───────────────────────────────────────────────────────

export type RequestStatus =
  | "pending_submission"  // optimistic, not yet confirmed by HCM
  | "pending_approval"    // confirmed by HCM, awaiting manager
  | "approved"
  | "denied"
  | "rolled_back";        // optimistic update reversed after HCM rejection

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  locationId: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  days: number;
  reason: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  hcmError?: string; // populated when HCM rejects
}

// ─── HCM API shapes ─────────────────────────────────────────────────────────

/** Response from GET /api/hcm/balance (single cell) */
export interface HcmBalanceResponse {
  employeeId: string;
  locationId: string;
  available: number;
  used: number;
  total: number;
  asOf: string;
}

/** Response from GET /api/hcm/balances/batch */
export interface HcmBatchResponse {
  balances: HcmBalanceResponse[];
  generatedAt: string;
}

/** Body for POST /api/hcm/requests */
export interface HcmSubmitRequestBody {
  employeeId: string;
  locationId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
}

/** Response from POST /api/hcm/requests */
export interface HcmSubmitRequestResponse {
  requestId: string;
  status: "accepted" | "rejected" | "silent_failure";
  message?: string;
  newBalance?: HcmBalanceResponse;
}

/** Response from PATCH /api/hcm/requests/:id */
export interface HcmApprovalResponse {
  requestId: string;
  status: "approved" | "denied";
  balance?: HcmBalanceResponse;
}

// ─── UI State ────────────────────────────────────────────────────────────────

export type BalanceStaleness = "fresh" | "stale" | "reconciling";

export interface BalanceWithMeta extends Balance {
  staleness: BalanceStaleness;
  optimisticDeduction?: number; // days deducted optimistically
}
