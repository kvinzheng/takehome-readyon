"use server";

import { AuthError } from "next-auth";
import { signIn, signOut, auth, getSessionUser } from "@/auth";
import { revalidatePath } from "next/cache";
import { dalSubmitTimeOff, dalApproveRequest, dalDenyRequest } from "@/lib/pto-dal";
import type { SubmitTimeOffPayload, TimeOffSubmissionResponse } from "@/types";

export async function login(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/employee",
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

  revalidatePath("/employee");
  return result;
}

export async function approveTimeOff(id: string): Promise<void> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = getSessionUser(session);
  if (user.role !== "manager") throw new Error("Unauthorized");

  await dalApproveRequest(id);
  revalidatePath("/manager");
}

export async function denyTimeOff(id: string): Promise<void> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const user = getSessionUser(session);
  if (user.role !== "manager") throw new Error("Unauthorized");

  await dalDenyRequest(id);
  revalidatePath("/manager");
}
