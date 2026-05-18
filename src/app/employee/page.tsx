import { auth, getSessionUser } from "@/auth";
import { redirect } from "next/navigation";
import {
  dalGetEmployeeBalances,
  dalGetEmployeeRequests,
  maybeGrantAnniversaryOnLogin,
} from "@/lib/pto-dal";
import { EmployeeClient } from "@/components/employee/EmployeeClient";

export default async function EmployeePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = getSessionUser(session);

  // Managers may view the employee dashboard too (read-only view of their
  // own balances). The role guard only blocks unauthenticated users.
  //
  // Auto-grant anniversary bonus if today is the anniversary. Fires only
  // for employees (managers shouldn't accrue PTO this way). Idempotent
  // per (employee, location, year).
  if (user.role === "employee") {
    await maybeGrantAnniversaryOnLogin(user.id);
  }

  const [balances, requests] = await Promise.all([
    dalGetEmployeeBalances(user.id),
    dalGetEmployeeRequests(user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10" data-testid="employee-view">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Time Off</h1>
        <p className="text-sm text-gray-500">
          {user.name} · Balances sourced from PTO system
        </p>
      </header>
      <EmployeeClient
        initialBalances={balances}
        initialRequests={requests}
      />
    </div>
  );
}
