import { getEmployeesHandler } from "@/route/pto/employees";
import { handleRoute, REFERENCE_DATA } from "@/route/pto/utils";

/** GET /route/pto/employees */
export async function GET() {
  return handleRoute(() => Promise.resolve(getEmployeesHandler()), {
    headers: REFERENCE_DATA,
  });
}
