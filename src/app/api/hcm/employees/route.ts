import { NextResponse } from "next/server";
import { EMPLOYEES, LOCATIONS } from "@/lib/hcm-store";

/** GET /api/hcm/employees — list all employees for the demo */
export async function GET() {
  return NextResponse.json({ employees: EMPLOYEES });
}
