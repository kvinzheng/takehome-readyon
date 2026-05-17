import { getBalance as storeGetBalance } from "@/lib/pto-store";
import type { Balance } from "@/types";
import { ValidationError, NotFoundError } from "./errors";

export async function getBalanceHandler(
  employeeId: string | null,
  locationId: string | null
): Promise<Balance> {
  if (!employeeId || !locationId) {
    throw new ValidationError("employeeId and locationId are required");
  }
  await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
  const balance = storeGetBalance(employeeId, locationId);
  if (!balance) {
    throw new NotFoundError("No balance found for this employee/location combination");
  }
  return balance;
}
