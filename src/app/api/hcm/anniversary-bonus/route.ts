import { NextRequest, NextResponse } from "next/server";
import { grantAnniversaryBonus, EMPLOYEES, LOCATIONS } from "@/lib/hcm-store";

/**
 * POST /api/hcm/anniversary-bonus
 * Body: { employeeId: string; locationId: string }
 *
 * Simulates a background HCM event (work anniversary, year-start refresh).
 * This is meant to be triggered from the UI test harness or Storybook to
 * prove the reconciliation path works.
 */
export async function POST(req: NextRequest) {
  const { employeeId, locationId } = await req.json();

  const validEmployee = EMPLOYEES.find((e) => e.id === employeeId);
  const validLocation = LOCATIONS.find((l) => l.id === locationId);

  if (!validEmployee || !validLocation) {
    return NextResponse.json(
      { error: "Invalid employee or location" },
      { status: 400 }
    );
  }

  const result = grantAnniversaryBonus(employeeId, locationId);

  if (!result.granted) {
    return NextResponse.json(
      { message: "Anniversary bonus already granted this session" },
      { status: 200 }
    );
  }

  return NextResponse.json({
    message: "Anniversary bonus of +5 days granted",
    balance: result.balance,
  });
}
