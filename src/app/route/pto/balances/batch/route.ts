import { getBatchBalancesHandler } from "@/route/pto/balances-batch";
import { handleRoute } from "@/route/pto/utils";

/** GET /route/pto/balances/batch */
export async function GET() {
  return handleRoute(getBatchBalancesHandler);
}
