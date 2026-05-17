import { auth, getSessionUser } from "@/auth";
import { redirect } from "next/navigation";
import { dalGetEmployeeBalances, dalGetEmployeeRequests } from "@/lib/pto-dal";
import { EmployeeClient } from "@/components/EmployeeClient";

export default async function EmployeePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = getSessionUser(session);
  if (user.role !== "employee") redirect("/login");

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
        employeeId={user.id}
        initialBalances={balances}
        initialRequests={requests}
      />
    </div>
  );
}
