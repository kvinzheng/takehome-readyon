import { NextRequest, NextResponse } from "next/server";
import {
  getRequest,
  updateRequestStatus,
  restoreBalance,
  getBalance,
} from "@/lib/pto-store";

/**
 * PATCH /api/pto/requests/:id
 * Body: { action: "approve" | "deny" }
 *
 * For "deny", the balance is restored. For "approve", balance remains as-is
 * (already deducted on submission). A fresh balance snapshot is returned either way.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { action } = await req.json();

  if (!["approve", "deny"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'deny'" }, { status: 400 });
  }

  const request = getRequest(id);
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (request.status !== "pending_approval") {
    return NextResponse.json(
      { error: `Request is already ${request.status}` },
      { status: 409 }
    );
  }

  await new Promise((r) => setTimeout(r, 80 + Math.random() * 120));

  if (action === "deny") {
    restoreBalance(request.employeeId, request.locationId, request.days);
    updateRequestStatus(id, "denied");
  } else {
    updateRequestStatus(id, "approved");
  }

  const balance = getBalance(request.employeeId, request.locationId);

  return NextResponse.json({
    requestId: id,
    status: action === "approve" ? "approved" : "denied",
    balance,
  });
}

/**
 * GET /api/pto/requests/:id
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const request = getRequest(id);
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  return NextResponse.json(request);
}
