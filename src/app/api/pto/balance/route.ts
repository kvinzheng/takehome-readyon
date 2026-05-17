import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "@/lib/pto-store";

/**
 * GET /api/hcm/balance?employeeId=X&locationId=Y
 * Real-time authoritative read for a single balance cell.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const locationId = searchParams.get("locationId");

  if (!employeeId || !locationId) {
    return NextResponse.json(
      { error: "employeeId and locationId are required" },
      { status: 400 }
    );
  }

  // Simulate real-time latency
  await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));

  const balance = getBalance(employeeId, locationId);
  if (!balance) {
    return NextResponse.json(
      { error: "No balance found for this employee/location combination" },
      { status: 404 }
    );
  }

  return NextResponse.json(balance);
}
