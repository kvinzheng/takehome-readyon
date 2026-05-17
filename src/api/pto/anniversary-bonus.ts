import { revalidatePath } from "next/cache";
import {
  grantAnniversaryBonus as storeGrantBonus,
  EMPLOYEES,
  LOCATIONS,
} from "@/lib/pto-store";
import { emitBalanceUpdate } from "@/lib/sse-bus";
import { ValidationError } from "./errors";

export async function grantAnniversaryBonusHandler(
  employeeId: string,
  locationId: string
): Promise<{ message: string; bonus?: number; granted: boolean }> {
  const validEmployee = EMPLOYEES.find((e) => e.id === employeeId);
  const validLocation = LOCATIONS.find((l) => l.id === locationId);

  if (!validEmployee || !validLocation) {
    throw new ValidationError("Invalid employee or location");
  }

  const result = storeGrantBonus(employeeId, locationId);
  if (!result.granted) {
    return { granted: false, message: "Anniversary bonus already granted this session" };
  }

  emitBalanceUpdate({ employeeId, locationId, bonus: 5, reason: "anniversary" });
  revalidatePath("/employee");

  return {
    granted: true,
    message: "Anniversary bonus of +5 days granted",
    bonus: 5,
  };
}
