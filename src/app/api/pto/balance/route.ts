import { NextRequest } from "next/server";
import { getBalanceHandler } from "@/api/pto/balance";
import { handleRoute } from "@/api/pto/utils";

/** GET /api/pto/balance?employeeId=X&locationId=Y */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return handleRoute(() =>
    getBalanceHandler(searchParams.get("employeeId"), searchParams.get("locationId"))
  );
}
