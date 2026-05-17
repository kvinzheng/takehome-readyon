import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { grantAnniversaryBonus, EMPLOYEES, LOCATIONS } from "@/lib/pto-store";

/**
 * POST /api/pto/anniversary-bonus
 * Body: { employeeId: string; locationId: string }
 *
 * Simulates a background PTO system event (work anniversary, year-start refresh).
 * After mutating the store, revalidates the employee page so the next server
 * render reflects the updated balance — no client-side polling required.
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

  // Invalidate the server cache so the next page render reflects the new balance.
  // The employee will see updated data on their next router.refresh() or navigation.
  revalidatePath("/employee");

  return NextResponse.json({
    message: "Anniversary bonus of +5 days granted",
    balance: result.balance,
  });
}
