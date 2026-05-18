import { getBatchBalancesHandler } from "@/route/pto/balances-batch";
import { handleRoute, NO_STORE } from "@/route/pto/utils";

/** GET /route/pto/balances/batch */
export async function GET() {
  return handleRoute(getBatchBalancesHandler, { headers: NO_STORE });
}
