import { auth, getSessionUser } from "@/auth";
import { redirect } from "next/navigation";
import {
  dalGetPendingRequests,
  dalGetBalance,
  dalGetAnniversaryEligibility,
} from "@/lib/pto-dal";
import { ManagerClient } from "@/components/manager/ManagerClient";

export default async function ManagerPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = getSessionUser(session);
  if (user.role !== "manager") redirect("/login");

  const [pendingRequests, anniversaryEligibility] = await Promise.all([
    dalGetPendingRequests(),
    dalGetAnniversaryEligibility(),
  ]);

  // Fetch live balance for every pending request in parallel — authoritative
  // snapshot at decision time, not cached.
  const balances = await Promise.all(
    pendingRequests.map((r) => dalGetBalance(r.employeeId, r.locationId))
  );

  const requestsWithBalances = pendingRequests.map((r, i) => ({
    request: r,
    balance: balances[i],
  }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10" data-testid="manager-view">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
        <p className="text-sm text-gray-500">
          {user.name} · Manager — balances shown are live PTO system reads
        </p>
      </header>
      <ManagerClient
        requestsWithBalances={requestsWithBalances}
        anniversaryEligibility={anniversaryEligibility}
      />
    </div>
  );
}
