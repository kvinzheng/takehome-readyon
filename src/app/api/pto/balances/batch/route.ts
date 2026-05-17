import { getBatchBalancesHandler } from "@/api/pto/balances-batch";
import { handleRoute } from "@/api/pto/utils";

/** GET /api/pto/balances/batch */
export async function GET() {
  return handleRoute(getBatchBalancesHandler);
}
