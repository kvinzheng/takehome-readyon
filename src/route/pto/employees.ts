import { EMPLOYEES } from "@/lib/pto-store";
import type { Employee } from "@/types";

export function getEmployeesHandler(): { employees: Employee[] } {
  return { employees: EMPLOYEES };
}
