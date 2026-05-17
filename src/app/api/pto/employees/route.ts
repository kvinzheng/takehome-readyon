import { getEmployeesHandler } from "@/api/pto/employees";
import { handleRoute } from "@/api/pto/utils";

/** GET /api/pto/employees */
export async function GET() {
  return handleRoute(() => Promise.resolve(getEmployeesHandler()));
}
