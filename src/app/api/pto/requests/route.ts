import { NextRequest, NextResponse } from "next/server";
import {
  deductBalance,
  createRequest,
  EMPLOYEES,
  LOCATIONS,
} from "@/lib/pto-store";
import type { SubmitTimeOffPayload } from "@/types";

/**
 * POST /api/hcm/requests
 * Submit a time-off request. Deducts balance if valid.
 *
 * Simulated failure modes (controlled by X-HCM-Scenario header or random):
 *  - "silent_failure": returns 200 but doesn't actually commit (tests defensive UX)
 *  - "conflict":       returns 409 with an error message
 *  - "insufficient":  returns 422 when balance is too low
 */
export async function POST(req: NextRequest) {
  const body: SubmitTimeOffPayload = await req.json();
  const scenario = req.headers.get("x-pto-scenario");

  // Validate dimensions
  const validEmployee = EMPLOYEES.find((e) => e.id === body.employeeId);
  const validLocation = LOCATIONS.find((l) => l.id === body.locationId);

  if (!validEmployee || !validLocation) {
    return NextResponse.json(
      { error: "Invalid employee or location" },
      { status: 400 }
    );
  }

  // Simulate network delay
  await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

  // ── Silent failure: appear to succeed but don't commit ──────────────────
  if (scenario === "silent_failure" || (!scenario && Math.random() < 0.05)) {
    // Return 200 with a fake requestId — balance not actually changed
    return NextResponse.json({
      requestId: `req-silent-${Date.now()}`,
      status: "silent_failure",
      message: "Request recorded",
    });
  }

  // ── Conflict: HCM rejects outright ──────────────────────────────────────
  if (scenario === "conflict") {
    return NextResponse.json(
      { error: "Request conflicts with an existing approved leave block" },
      { status: 409 }
    );
  }

  // Attempt balance deduction
  const result = deductBalance(body.employeeId, body.locationId, body.days);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Insufficient balance" },
      { status: 422 }
    );
  }

  // Create the request record in the HCM store
  const request = createRequest({
    employeeId: body.employeeId,
    locationId: body.locationId,
    startDate: body.startDate,
    endDate: body.endDate,
    days: body.days,
    reason: body.reason,
  });

  return NextResponse.json({
    requestId: request.id,
    status: "accepted",
    message: "Request submitted successfully",
    newBalance: result.balance,
  });
}

/**
 * GET /api/pto/requests?employeeId=X
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");

  const { getAllRequests, getRequestsForEmployee } = await import(
    "@/lib/pto-store"
  );
  const requests = employeeId
    ? getRequestsForEmployee(employeeId)
    : getAllRequests();

  return NextResponse.json({ requests });
}
