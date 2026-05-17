import { NextRequest } from "next/server";
import { grantAnniversaryBonusHandler } from "@/api/pto/anniversary-bonus";
import { handleRoute } from "@/api/pto/utils";

/** POST /api/pto/anniversary-bonus — Body: { employeeId, locationId } */
export async function POST(req: NextRequest) {
  const { employeeId, locationId } = await req.json();
  return handleRoute(() => grantAnniversaryBonusHandler(employeeId, locationId));
}
