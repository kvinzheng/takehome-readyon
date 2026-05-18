"use server";

import { AuthError } from "next-auth";
import { signIn, signOut, auth, getSessionUser } from "@/auth";
import { updateTag } from "next/cache";
import {
  dalSubmitTimeOff,
  dalApproveRequest,
  dalDenyRequest,
  dalGrantAnniversaryBonus,
  ptoTags,
} from "@/lib/pto-dal";
import { emitPtoUpdate } from "@/lib/sse-bus";
import type { SubmitTimeOffPayload, TimeOffSubmissionResponse } from "@/types";

export async function login(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return null;
  } catch (err) {
    if (err instanceof AuthError) {
      return "Invalid email or password.";
    }
    throw err; // re-throw Next.js redirect errors
  }
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export async function submitTimeOff(
  payload: Omit<SubmitTimeOffPayload, "employeeId">
): Promise<TimeOffSubmissionResponse> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = getSessionUser(session);
  if (user.role !== "employee") throw new Error("Unauthorized");

  const result = await dalSubmitTimeOff({
    ...payload,
    employeeId: user.id,
  });

  // Submission affects: this employee's balance, this employee's request list,
  // and the global pending queue managers see.
  updateTag(ptoTags.balances(user.id));
  updateTag(ptoTags.employeeRequests(user.id));
  updateTag(ptoTags.pendingRequests());

  // Push to other open tabs (manager queue, employee’s second tab, etc.)
  emitPtoUpdate({
    employeeId: user.id,
    locationId: payload.locationId,
    reason: "submit",
  });
  return result;
}

export async function approveTimeOff(id: string): Promise<void> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = getSessionUser(session);
  if (user.role !== "manager") throw new Error("Unauthorized");

  const { employeeId } = await dalApproveRequest(id);

  // Approval removes the request from the pending queue and leaves the
  // employee's deducted balance in place — but the request status on the
  // employee's view changes from pending → approved.
  updateTag(ptoTags.pendingRequests());
  updateTag(ptoTags.employeeRequests(employeeId));

  // Push to the employee tab so they see status flip to “approved” live.
  emitPtoUpdate({ employeeId, reason: "approve" });
}

export async function denyTimeOff(id: string): Promise<void> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = getSessionUser(session);
  if (user.role !== "manager") throw new Error("Unauthorized");

  const { employeeId } = await dalDenyRequest(id);

  // Denial restores the balance AND updates the request status, so both
  // tags need to flip.
  updateTag(ptoTags.pendingRequests());
  updateTag(ptoTags.employeeRequests(employeeId));
  updateTag(ptoTags.balances(employeeId));

  // Push to the employee tab — their balance comes back and request flips.
  emitPtoUpdate({ employeeId, reason: "deny" });
}

/**
 * Manager-triggered anniversary bonus grant.
 *
 * Idempotent per (employee, location, year) — the store guards against
 * double-grants. Emits an SSE balance-update so the employee sees the bump
 * live without a refresh.
 */
export async function grantAnniversaryBonus(employeeId: string): Promise<{ granted: boolean }> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = getSessionUser(session);
  if (user.role !== "manager") throw new Error("Unauthorized");

  const result = await dalGrantAnniversaryBonus(employeeId);

  if (result.granted && result.locationId) {
    updateTag(ptoTags.balances(employeeId));
    emitPtoUpdate({
      employeeId,
      locationId: result.locationId,
      bonus: result.bonus ?? 0,
      reason: "anniversary",
    });
  }

  return { granted: result.granted };
}
