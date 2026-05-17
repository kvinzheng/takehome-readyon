import { NextRequest } from "next/server";
import { getBalanceHandler } from "@/route/pto/balance";
import { handleRoute } from "@/route/pto/utils";

/** GET /api/pto/balance?employeeId=X&locationId=Y */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return handleRoute(() =>
    getBalanceHandler(searchParams.get("employeeId"), searchParams.get("locationId"))
  );
}
