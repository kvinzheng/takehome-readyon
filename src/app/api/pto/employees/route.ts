import { getEmployeesHandler } from "@/route/pto/employees";
import { handleRoute } from "@/route/pto/utils";

/** GET /api/pto/employees */
export async function GET() {
  return handleRoute(() => Promise.resolve(getEmployeesHandler()));
}
